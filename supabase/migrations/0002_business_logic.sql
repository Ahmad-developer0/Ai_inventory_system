-- =====================================================================
-- Business logic: sales, purchases, quotations, payments, dashboard
-- Har function aik transaction hai: koi bhi check fail ho to kuch save nahi hota.
-- =====================================================================

-- Sales tax rate (18%). Badalna ho to sirf yahan badlein.
create function public.tax_rate() returns numeric language sql immutable as $$ select 0.18::numeric $$;

-- ---------------------------------------------------------------------
-- Sale: price database se aati hai, stock OUT hota hai, payment record hoti hai.
-- p_items: [{"product_id": 1, "qty": 2, "discount_pct": 0}]
-- ---------------------------------------------------------------------
create function public.create_sale(
  p_customer_id bigint,
  p_walk_in_name text,
  p_walk_in_phone text,
  p_payment_mode public.payment_mode,
  p_payment_days integer,
  p_amount_received numeric,
  p_apply_tax boolean,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := public.current_user_role();
  v_sale_id bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_disc numeric;
  v_price numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_tax numeric;
  v_total numeric;
  v_received numeric;
begin
  if v_role is null then
    raise exception 'Not authorized';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Kam az kam aik item zaroori hai';
  end if;

  insert into public.sales (customer_id, walk_in_name, walk_in_phone, payment_mode, payment_days, created_by)
  values (p_customer_id, nullif(trim(p_walk_in_name), ''), nullif(trim(p_walk_in_phone), ''),
          p_payment_mode, coalesce(p_payment_days, 0), auth.uid())
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;
    v_disc := coalesce((v_item ->> 'discount_pct')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity 0 se zyada honi chahiye';
    end if;
    if v_disc < 0 or v_disc > 100 then
      raise exception 'Discount 0 aur 100%% ke darmiyan hona chahiye';
    end if;

    select * into v_product from public.products
    where id = (v_item ->> 'product_id')::bigint and active
    for update;
    if not found then
      raise exception 'Product nahi mila (id %)', v_item ->> 'product_id';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Stock kam hai: % (available %, required %)', v_product.name, v_product.stock, v_qty;
    end if;

    v_price := round(v_product.selling_price * (1 - v_disc / 100), 2);
    if v_price < v_product.min_price and v_role = 'salesperson' then
      raise exception 'Minimum price se kam: % (minimum Rs %). Manager approval ke liye quotation banayein.',
        v_product.name, v_product.min_price;
    end if;

    v_line := v_price * v_qty;
    insert into public.sale_items (sale_id, product_id, qty, unit_price, discount_pct, line_total)
    values (v_sale_id, v_product.id, v_qty, v_product.selling_price, v_disc, v_line);
    insert into public.stock_movements (product_id, type, qty, reference, created_by)
    values (v_product.id, 'OUT', -v_qty, 'SALE-' || v_sale_id, auth.uid());
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_tax := case when p_apply_tax then round(v_subtotal * public.tax_rate(), 2) else 0 end;
  v_total := v_subtotal + v_tax;
  update public.sales set subtotal = v_subtotal, tax = v_tax, total = v_total where id = v_sale_id;

  v_received := case when p_payment_mode = 'Due' then 0
                     else least(greatest(coalesce(p_amount_received, v_total), 0), v_total) end;
  if p_customer_id is null and v_received < v_total then
    raise exception 'Walk-in customer se poori payment zaroori hai (udhaar sirf registered customer ko)';
  end if;
  if v_received > 0 then
    insert into public.payments (direction, sale_id, mode, amount, reference, created_by)
    values ('received', v_sale_id, p_payment_mode, v_received, 'SALE-' || v_sale_id, auth.uid());
  end if;

  return v_sale_id;
end $$;

-- ---------------------------------------------------------------------
-- Purchase: stock IN hota hai aur product ki purchase price latest cost ho jati hai.
-- p_items: [{"product_id": 1, "qty": 5, "unit_cost": 198000}]
-- ---------------------------------------------------------------------
create function public.create_purchase(
  p_supplier_id bigint,
  p_bill_no text,
  p_payment_mode public.payment_mode,
  p_payment_days integer,
  p_amount_paid numeric,
  p_apply_tax boolean,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_purchase_id bigint;
  v_item jsonb;
  v_product_id bigint;
  v_qty integer;
  v_cost numeric;
  v_subtotal numeric := 0;
  v_tax numeric;
  v_total numeric;
  v_paid numeric;
begin
  if not public.is_manager() then
    raise exception 'Sirf admin ya manager purchase daal sakte hain';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Kam az kam aik item zaroori hai';
  end if;

  insert into public.purchases (supplier_id, bill_no, payment_mode, payment_days, created_by)
  values (p_supplier_id, nullif(trim(p_bill_no), ''), p_payment_mode, coalesce(p_payment_days, 0), auth.uid())
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item ->> 'product_id')::bigint;
    v_qty := (v_item ->> 'qty')::integer;
    v_cost := (v_item ->> 'unit_cost')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity 0 se zyada honi chahiye';
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'Cost price sahi nahi hai';
    end if;
    if not exists (select 1 from public.products where id = v_product_id) then
      raise exception 'Product nahi mila (id %)', v_product_id;
    end if;

    insert into public.purchase_items (purchase_id, product_id, qty, unit_cost, line_total)
    values (v_purchase_id, v_product_id, v_qty, v_cost, v_cost * v_qty);
    insert into public.stock_movements (product_id, type, qty, reference, created_by)
    values (v_product_id, 'IN', v_qty, 'PUR-' || v_purchase_id, auth.uid());
    update public.products set purchase_price = v_cost where id = v_product_id;
    v_subtotal := v_subtotal + v_cost * v_qty;
  end loop;

  v_tax := case when p_apply_tax then round(v_subtotal * public.tax_rate(), 2) else 0 end;
  v_total := v_subtotal + v_tax;
  update public.purchases set subtotal = v_subtotal, tax = v_tax, total = v_total where id = v_purchase_id;

  v_paid := case when p_payment_mode = 'Due' then 0
                 else least(greatest(coalesce(p_amount_paid, v_total), 0), v_total) end;
  if v_paid > 0 then
    insert into public.payments (direction, purchase_id, mode, amount, reference, created_by)
    values ('paid', v_purchase_id, p_payment_mode, v_paid, 'PUR-' || v_purchase_id, auth.uid());
  end if;

  return v_purchase_id;
end $$;

-- ---------------------------------------------------------------------
-- Quotation: price database se. Minimum se kam ho to status pending_approval.
-- p_items: [{"product_id": 1, "qty": 2, "discount_pct": 5}]
-- ---------------------------------------------------------------------
create function public.create_quotation(
  p_customer_id bigint,
  p_valid_days integer,
  p_apply_tax boolean,
  p_notes text,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
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
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Kam az kam aik item zaroori hai';
  end if;

  insert into public.quotations (customer_id, valid_until, notes, created_by)
  values (p_customer_id, current_date + coalesce(p_valid_days, 7), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_quote_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;
    v_disc := coalesce((v_item ->> 'discount_pct')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity 0 se zyada honi chahiye';
    end if;
    if v_disc < 0 or v_disc > 100 then
      raise exception 'Discount 0 aur 100%% ke darmiyan hona chahiye';
    end if;

    select * into v_product from public.products where id = (v_item ->> 'product_id')::bigint and active;
    if not found then
      raise exception 'Product nahi mila (id %)', v_item ->> 'product_id';
    end if;

    v_price := round(v_product.selling_price * (1 - v_disc / 100), 2);
    v_below := v_price < v_product.min_price;
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

-- Manager minimum-price wali quotation approve ya reject karta hai.
create function public.decide_quotation(p_quotation_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Sirf admin ya manager approve kar sakte hain';
  end if;
  update public.quotations
  set status = case when p_approve then 'approved'::public.quotation_status else 'rejected'::public.quotation_status end,
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_quotation_id and status = 'pending_approval';
  if not found then
    raise exception 'Yeh quotation approval ke intezar mein nahi hai';
  end if;
end $$;

-- Staff: approved -> sent -> accepted / rejected
create function public.set_quotation_status(p_quotation_id bigint, p_status public.quotation_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current public.quotation_status;
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;
  select status into v_current from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation nahi mili';
  end if;
  if not (
    (v_current = 'approved' and p_status in ('sent', 'accepted', 'rejected'))
    or (v_current = 'sent' and p_status in ('accepted', 'rejected'))
  ) then
    raise exception 'Status % se % nahi ho sakta', v_current, p_status;
  end if;
  update public.quotations set status = p_status where id = p_quotation_id;
end $$;

-- ---------------------------------------------------------------------
-- Payment: customer se received, ya supplier ko paid
-- ---------------------------------------------------------------------
create function public.record_payment(
  p_direction text,
  p_document_id bigint,
  p_amount numeric,
  p_mode public.payment_mode,
  p_reference text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_pending numeric;
  v_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount 0 se zyada honi chahiye';
  end if;
  if p_mode = 'Due' then
    raise exception 'Payment mode Cash, Bank Transfer ya Cheque hona chahiye';
  end if;

  if p_direction = 'received' then
    if not public.is_staff() then raise exception 'Not authorized'; end if;
    select total - amount_received into v_pending from public.sales where id = p_document_id for update;
  elsif p_direction = 'paid' then
    if not public.is_manager() then raise exception 'Sirf admin ya manager supplier ko payment kar sakte hain'; end if;
    select total - amount_paid into v_pending from public.purchases where id = p_document_id for update;
  else
    raise exception 'Direction received ya paid honi chahiye';
  end if;

  if v_pending is null then
    raise exception 'Invoice nahi mili';
  end if;
  if p_amount > v_pending then
    raise exception 'Amount pending (Rs %) se zyada hai', v_pending;
  end if;

  insert into public.payments (direction, sale_id, purchase_id, mode, amount, reference, created_by)
  values (
    p_direction,
    case when p_direction = 'received' then p_document_id end,
    case when p_direction = 'paid' then p_document_id end,
    p_mode, p_amount, nullif(trim(p_reference), ''), auth.uid()
  )
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Dashboard statistics
-- ---------------------------------------------------------------------
create function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month_start date := date_trunc('month', current_date)::date;
begin
  if not public.is_staff() then
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

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------

-- Staff aur (baad mein) AI agent ke liye catalog: purchase_price shamil NAHI hai.
-- Yeh view owner ke rights se chalta hai taake salesperson ko products table ka access na dena pade.
create view public.product_catalog as
select
  p.id, p.sku, p.name, p.brand, p.model, p.category_id, c.name as category_name, p.specifications,
  p.selling_price, p.min_price, p.stock, p.reorder_level, p.image_path, p.datasheet_path, p.active,
  case when p.stock = 0 then 'out' when p.stock <= p.reorder_level then 'low' else 'ok' end as stock_status
from public.products p
left join public.categories c on c.id = p.category_id
where public.is_staff();

create view public.sales_view with (security_invoker = true) as
select
  s.*,
  coalesce(c.name, s.walk_in_name, 'Walk-in customer') as party_name,
  coalesce((select sum(i.qty) from public.sale_items i where i.sale_id = s.id), 0) as item_count,
  s.total - s.amount_received as pending,
  case when s.amount_received >= s.total then 'paid' when s.amount_received > 0 then 'partial' else 'unpaid' end as payment_status,
  s.sale_date + s.payment_days as due_date
from public.sales s
left join public.customers c on c.id = s.customer_id;

create view public.purchases_view with (security_invoker = true) as
select
  p.*,
  sp.name as party_name,
  coalesce((select sum(i.qty) from public.purchase_items i where i.purchase_id = p.id), 0) as item_count,
  p.total - p.amount_paid as pending,
  case when p.amount_paid >= p.total then 'paid' when p.amount_paid > 0 then 'partial' else 'unpaid' end as payment_status,
  p.purchase_date + p.payment_days as due_date
from public.purchases p
join public.suppliers sp on sp.id = p.supplier_id;

create view public.quotations_view with (security_invoker = true) as
select
  q.*,
  'QT-' || lpad(q.id::text, 4, '0') as quote_no,
  c.name as customer_name,
  c.phone as customer_phone,
  coalesce((select count(*) from public.quotation_items i where i.quotation_id = q.id), 0) as item_count,
  pr.full_name as created_by_name
from public.quotations q
join public.customers c on c.id = q.customer_id
left join public.profiles pr on pr.id = q.created_by;

create view public.payments_view with (security_invoker = true) as
select
  pm.*,
  coalesce(c.name, s.walk_in_name, sp.name, 'Walk-in customer') as party_name
from public.payments pm
left join public.sales s on s.id = pm.sale_id
left join public.customers c on c.id = s.customer_id
left join public.purchases pu on pu.id = pm.purchase_id
left join public.suppliers sp on sp.id = pu.supplier_id;

create view public.stock_movements_view with (security_invoker = true) as
select m.*, p.name as product_name, p.sku, pr.full_name as created_by_name
from public.stock_movements m
join public.product_catalog p on p.id = m.product_id
left join public.profiles pr on pr.id = m.created_by;
