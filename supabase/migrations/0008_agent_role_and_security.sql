-- =====================================================================
-- 0008: AI agent role + security hardening
--
-- AI agent (role 'agent'):
--   * reads the product catalog (selling + minimum price, stock, photos; never purchase price)
--   * can look up / add customers and create quotations, but never below the minimum price
--   * cannot record sales or payments, approve anything, or see sales, payments, stock
--     history, suppliers or staff
-- Humans: salesperson stays at or above the minimum price; admin/manager can give any discount.
--
-- Hardening:
--   * new sign-ups start DISABLED (an admin must enable them) - blocks self-registration
--   * payment date cannot be before the sale/purchase date
--   * storage bucket accepts only images and PDFs, max 10 MB
--   * audit log of sensitive changes (prices, roles, deletions), readable by admins only
-- Run once in the Supabase SQL Editor.
-- =====================================================================

alter type public.user_role add value if not exists 'agent';

-- Human staff only (everyone except the AI agent)
create function public.is_human_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text from public.profiles where id = auth.uid() and active) in ('admin', 'manager', 'salesperson'), false)
$$;
grant execute on function public.is_human_staff() to authenticated;
revoke all on function public.is_human_staff() from anon, public;

-- ---------------------------------------------------------------------
-- New accounts start disabled; only the very first account (owner) is an active admin
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when v_first then 'admin'::public.user_role else 'salesperson'::public.user_role end,
    v_first
  );
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Row level security: the agent sees only what it needs
-- ---------------------------------------------------------------------
drop policy "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles for select to authenticated
  using (public.is_human_staff() or id = auth.uid());

drop policy "staff read movements" on public.stock_movements;
create policy "staff read movements" on public.stock_movements for select to authenticated using (public.is_human_staff());

drop policy "staff read suppliers" on public.suppliers;
create policy "staff read suppliers" on public.suppliers for select to authenticated using (public.is_human_staff());

drop policy "staff read sales" on public.sales;
create policy "staff read sales" on public.sales for select to authenticated using (public.is_human_staff());
drop policy "staff read sale items" on public.sale_items;
create policy "staff read sale items" on public.sale_items for select to authenticated using (public.is_human_staff());

drop policy "read payments" on public.payments;
create policy "read payments" on public.payments for select to authenticated
  using (public.is_manager() or (direction = 'received' and public.is_human_staff()));

-- Agent sees only the quotations it created
drop policy "staff read quotations" on public.quotations;
create policy "staff read quotations" on public.quotations for select to authenticated
  using (public.is_human_staff() or (public.is_staff() and created_by = auth.uid()));
drop policy "staff read quotation items" on public.quotation_items;
create policy "staff read quotation items" on public.quotation_items for select to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id));

-- Customers: agent can look up and add, but not edit existing customers
drop policy "staff update customers" on public.customers;
create policy "staff update customers" on public.customers for update to authenticated using (public.is_human_staff());

-- ---------------------------------------------------------------------
-- Functions: block the agent where it must not act
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month_start date := date_trunc('month', current_date)::date;
begin
  if not public.is_human_staff() then
    raise exception 'Not authorized';
  end if;
  return jsonb_build_object(
    'sales_this_month', (select coalesce(sum(total), 0) from public.sales where sale_date >= v_month_start),
    'sales_last_month', (select coalesce(sum(total), 0) from public.sales
                         where sale_date >= (v_month_start - interval '1 month')::date and sale_date < v_month_start),
    'sales_today', (select count(*) from public.sales where sale_date = current_date),
    'open_quotations', (select count(*) from public.quotations where status in ('draft', 'pending_approval', 'approved', 'sent')),
    'pending_approvals', (select count(*) from public.quotations where status = 'pending_approval'),
    'receivables', (select coalesce(sum(total - amount_received), 0) from public.sales),
    'payables', case when public.is_manager()
                     then (select coalesce(sum(total - amount_paid), 0) from public.purchases) end,
    'low_stock', (select count(*) from public.products where active and stock > 0 and stock <= reorder_level),
    'out_of_stock', (select count(*) from public.products where active and stock = 0),
    'monthly', (
      select jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'), 'total', coalesce(s.total, 0)) order by m)
      from generate_series(v_month_start - interval '5 months', v_month_start, interval '1 month') m
      left join lateral (
        select sum(total) as total from public.sales
        where sale_date >= m::date and sale_date < (m + interval '1 month')::date
      ) s on true
    )
  );
end $$;

-- Agent cannot quote below the minimum price (humans get a manager-approval quotation instead)
create or replace function public.create_quotation(
  p_customer_id bigint,
  p_valid_days integer,
  p_apply_tax boolean,
  p_notes text,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.current_user_role()::text;
  v_quote_id bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_disc numeric;
  v_price numeric;
  v_below boolean;
  v_needs_approval boolean := false;
  v_subtotal numeric := 0;
  v_tax numeric;
begin
  if v_role is null then
    raise exception 'Not authorized';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;
  if coalesce(p_valid_days, 7) not between 1 and 90 then
    raise exception 'Validity must be between 1 and 90 days';
  end if;

  insert into public.quotations (customer_id, valid_until, notes, created_by)
  values (p_customer_id, current_date + coalesce(p_valid_days, 7), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_quote_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;
    v_disc := coalesce((v_item ->> 'discount_pct')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    if v_disc < 0 or v_disc > 100 then
      raise exception 'Discount must be between 0 and 100%%';
    end if;

    select * into v_product from public.products where id = (v_item ->> 'product_id')::bigint and active;
    if not found then
      raise exception 'Product not found (id %)', v_item ->> 'product_id';
    end if;

    v_price := round(v_product.selling_price * (1 - v_disc / 100), 2);
    v_below := v_price < v_product.min_price;
    if v_below and v_role = 'agent' then
      raise exception 'The lowest price for % is Rs % per %', v_product.name, v_product.min_price, v_product.unit;
    end if;
    v_needs_approval := v_needs_approval or v_below;

    insert into public.quotation_items (quotation_id, product_id, qty, unit_price, discount_pct, line_total, below_min)
    values (v_quote_id, v_product.id, v_qty, v_product.selling_price, v_disc, v_price * v_qty, v_below);
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  v_tax := case when p_apply_tax then round(v_subtotal * public.tax_rate(), 2) else 0 end;
  update public.quotations
  set subtotal = v_subtotal,
      tax = v_tax,
      total = v_subtotal + v_tax,
      needs_approval = v_needs_approval,
      status = case when v_needs_approval then 'pending_approval'::public.quotation_status else 'approved'::public.quotation_status end
  where id = v_quote_id;

  return v_quote_id;
end $$;

-- Status changes: humans only
create or replace function public.set_quotation_status(p_quotation_id bigint, p_status public.quotation_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current public.quotation_status;
begin
  if not public.is_human_staff() then
    raise exception 'Not authorized';
  end if;
  select status into v_current from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found';
  end if;
  if not (
    (v_current = 'approved' and p_status in ('sent', 'accepted', 'rejected'))
    or (v_current = 'sent' and p_status in ('accepted', 'rejected'))
  ) then
    raise exception 'Cannot change status from % to %', v_current, p_status;
  end if;
  update public.quotations set status = p_status where id = p_quotation_id;
end $$;

-- Payments: humans only, and not dated before the bill
create or replace function public.record_payment(
  p_direction text,
  p_document_id bigint,
  p_amount numeric,
  p_mode public.payment_mode,
  p_reference text,
  p_payment_date date default current_date
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_pending numeric;
  v_doc_date date;
  v_id bigint;
begin
  if not public.is_human_staff() then
    raise exception 'Not authorized';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if p_mode = 'Due' then
    raise exception 'Payment mode must be Cash, Bank Transfer or Cheque';
  end if;
  if p_payment_date > current_date then
    raise exception 'Payment date cannot be in the future';
  end if;

  if p_direction = 'received' then
    select total - amount_received, sale_date into v_pending, v_doc_date from public.sales where id = p_document_id for update;
  elsif p_direction = 'paid' then
    if not public.is_manager() then raise exception 'Only an admin or manager can pay suppliers'; end if;
    select total - amount_paid, purchase_date into v_pending, v_doc_date from public.purchases where id = p_document_id for update;
  else
    raise exception 'Direction must be received or paid';
  end if;

  if v_pending is null then
    raise exception 'Invoice not found';
  end if;
  if p_payment_date < v_doc_date then
    raise exception 'Payment date cannot be before the bill date (%)', v_doc_date;
  end if;
  if p_amount > v_pending then
    raise exception 'Amount is more than the pending balance (Rs %)', v_pending;
  end if;

  insert into public.payments (payment_date, direction, sale_id, purchase_id, mode, amount, reference, created_by)
  values (
    coalesce(p_payment_date, current_date),
    p_direction,
    case when p_direction = 'received' then p_document_id end,
    case when p_direction = 'paid' then p_document_id end,
    p_mode, p_amount, nullif(trim(p_reference), ''), auth.uid()
  )
  returning id into v_id;
  return v_id;
end $$;

-- Sales: humans only. Wrapper check added in front of the existing create_sale logic.
create or replace function public.block_agent_sales() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_human_staff() then
    raise exception 'Only staff can record sales';
  end if;
  return new;
end $$;

create trigger sales_humans_only before insert on public.sales
  for each row execute function public.block_agent_sales();

-- ---------------------------------------------------------------------
-- Storage: only images and PDFs, max 10 MB
-- ---------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf'],
    file_size_limit = 10485760
where id = 'product-files';

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  table_name text not null,
  record_id text,
  action text not null,
  changes jsonb
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
create policy "admins read audit log" on public.audit_logs for select to authenticated using (public.is_admin());
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- Records which watched columns changed (old -> new), or the deleted row
create function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes jsonb := '{}';
  v_key text;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' then
    foreach v_key in array tg_argv loop
      if v_old -> v_key is distinct from v_new -> v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}' then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    v_changes := v_old;
  else
    v_changes := v_new;
  end if;

  insert into public.audit_logs (table_name, record_id, action, changes)
  values (tg_table_name, coalesce(v_new ->> 'id', v_old ->> 'id'), lower(tg_op), v_changes);
  return coalesce(new, old);
end $$;

create trigger audit_products after update or delete on public.products
  for each row execute function public.write_audit_log('selling_price', 'min_price', 'purchase_price', 'active', 'name', 'sku', 'unit');
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function public.write_audit_log('role', 'active', 'full_name');
create trigger audit_customers after delete on public.customers
  for each row execute function public.write_audit_log();
create trigger audit_suppliers after delete on public.suppliers
  for each row execute function public.write_audit_log();
create trigger audit_payments after insert on public.payments
  for each row execute function public.write_audit_log();
create trigger audit_quotation_decisions after update on public.quotations
  for each row execute function public.write_audit_log('status');

notify pgrst, 'reload schema';
