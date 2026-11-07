-- =====================================================================
-- 0005: Sales update
--   * Sale buyer types: customer (walk-in), shopkeeper, supplier
--   * Buyer name / shop name / phone are typed on the sale; shopkeepers and
--     suppliers are matched by phone number or created automatically
--   * Payment date can be chosen (no future dates)
--   * Units of measure per product (pcs, ft, yard, meter, roll, set, box)
--   * 'Shopkeeper' customer type
--   * All database messages in English
-- Run once in the Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------
alter table public.sales add column supplier_id bigint references public.suppliers (id) on delete restrict;
alter table public.sales add constraint one_buyer_only check (customer_id is null or supplier_id is null);

alter table public.customers drop constraint customers_type_check;
alter table public.customers add constraint customers_type_check
  check (type in ('Shopkeeper', 'Retail', 'Dealer', 'Installer'));

alter table public.customers add column shop_name text;
alter table public.suppliers add column contact_name text;
grant insert (shop_name), update (shop_name) on public.customers to authenticated;
grant insert (contact_name), update (contact_name) on public.suppliers to authenticated;

-- Phone numbers match on their last 10 digits: 0315-7558885, +92 315 7558885 and 3157558885 are the same
create function public.phone_key(p text) returns text
language sql immutable as $$ select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '') $$;
grant execute on function public.phone_key(text) to authenticated;

alter table public.products add column unit text not null default 'pcs'
  check (unit in ('pcs', 'ft', 'yard', 'meter', 'roll', 'set', 'box'));

-- Existing cable products from the starter data
update public.products set unit = 'meter' where sku = 'CAB-AC-4C10';
update public.products set unit = 'roll' where sku = 'CAB-DC-6';

grant insert (unit), update (unit) on public.products to authenticated;

-- ---------------------------------------------------------------------
-- Stock movement trigger (English message)
-- ---------------------------------------------------------------------
create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stock integer;
  v_name text;
  v_unit text;
begin
  select stock, name, unit into v_stock, v_name, v_unit from public.products where id = new.product_id for update;
  if v_stock + new.qty < 0 then
    raise exception 'Not enough stock for %: % % available, % % required', v_name, v_stock, v_unit, -new.qty, v_unit;
  end if;
  update public.products set stock = stock + new.qty where id = new.product_id;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- create_sale: supplier buyer, walk-in name/phone required
-- ---------------------------------------------------------------------
drop function public.create_sale(bigint, text, text, public.payment_mode, integer, numeric, boolean, jsonb);

-- p_buyer_type: 'customer' (walk-in), 'shopkeeper' or 'supplier'
--   customer   : p_name + p_phone, saved on the sale
--   shopkeeper : p_name + p_shop_name + p_phone, matched/created in customers (type Shopkeeper)
--   supplier   : p_shop_name (company) + p_phone (+ optional p_name contact), matched/created in suppliers
create function public.create_sale(
  p_buyer_type text,
  p_name text,
  p_shop_name text,
  p_phone text,
  p_payment_mode public.payment_mode,
  p_payment_days integer,
  p_amount_received numeric,
  p_apply_tax boolean,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := public.current_user_role();
  v_key text := public.phone_key(p_phone);
  v_name text := nullif(trim(p_name), '');
  v_shop text := nullif(trim(p_shop_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_customer_id bigint;
  v_supplier_id bigint;
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
    raise exception 'Add at least one item';
  end if;
  if v_key is null or length(v_key) < 10 then
    raise exception 'A valid phone number is required';
  end if;

  if p_buyer_type = 'customer' then
    if v_name is null then raise exception 'Customer name is required'; end if;
  elsif p_buyer_type = 'shopkeeper' then
    if v_name is null then raise exception 'Shopkeeper name is required'; end if;
    if v_shop is null then raise exception 'Shop name is required'; end if;
    select id into v_customer_id from public.customers
    where type = 'Shopkeeper' and public.phone_key(phone) = v_key
    order by id limit 1;
    if v_customer_id is null then
      insert into public.customers (name, shop_name, phone, type)
      values (v_name, v_shop, v_phone, 'Shopkeeper')
      returning id into v_customer_id;
    else
      -- keep the saved record, only fill in what is missing
      update public.customers
      set shop_name = coalesce(nullif(shop_name, ''), v_shop)
      where id = v_customer_id;
    end if;
  elsif p_buyer_type = 'supplier' then
    if v_shop is null then raise exception 'Supplier company / shop name is required'; end if;
    select id into v_supplier_id from public.suppliers
    where public.phone_key(phone) = v_key
    order by id limit 1;
    if v_supplier_id is null then
      insert into public.suppliers (name, contact_name, phone)
      values (v_shop, v_name, v_phone)
      returning id into v_supplier_id;
    else
      update public.suppliers
      set contact_name = coalesce(nullif(contact_name, ''), v_name)
      where id = v_supplier_id;
    end if;
  else
    raise exception 'Buyer type must be customer, shopkeeper or supplier';
  end if;

  insert into public.sales (customer_id, supplier_id, walk_in_name, walk_in_phone, payment_mode, payment_days, created_by)
  values (v_customer_id, v_supplier_id,
          case when p_buyer_type = 'customer' then v_name end,
          case when p_buyer_type = 'customer' then v_phone end,
          p_payment_mode, coalesce(p_payment_days, 0), auth.uid())
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::integer;
    v_disc := coalesce((v_item ->> 'discount_pct')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    if v_disc < 0 or v_disc > 100 then
      raise exception 'Discount must be between 0 and 100%%';
    end if;

    select * into v_product from public.products
    where id = (v_item ->> 'product_id')::bigint and active
    for update;
    if not found then
      raise exception 'Product not found (id %)', v_item ->> 'product_id';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Not enough stock for %: % % available, % % required',
        v_product.name, v_product.stock, v_product.unit, v_qty, v_product.unit;
    end if;

    v_price := round(v_product.selling_price * (1 - v_disc / 100), 2);
    if v_price < v_product.min_price and v_role = 'salesperson' then
      raise exception 'Price below minimum for % (minimum Rs %). Create a quotation for manager approval.',
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
  if v_received > 0 then
    insert into public.payments (direction, sale_id, mode, amount, reference, created_by)
    values ('received', v_sale_id, p_payment_mode, v_received, 'SALE-' || v_sale_id, auth.uid());
  end if;

  return v_sale_id;
end $$;

-- ---------------------------------------------------------------------
-- create_purchase (English messages)
-- ---------------------------------------------------------------------
create or replace function public.create_purchase(
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
    raise exception 'Only an admin or manager can record purchases';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;

  insert into public.purchases (supplier_id, bill_no, payment_mode, payment_days, created_by)
  values (p_supplier_id, nullif(trim(p_bill_no), ''), p_payment_mode, coalesce(p_payment_days, 0), auth.uid())
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item ->> 'product_id')::bigint;
    v_qty := (v_item ->> 'qty')::integer;
    v_cost := (v_item ->> 'unit_cost')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be greater than 0';
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'Invalid cost price';
    end if;
    if not exists (select 1 from public.products where id = v_product_id) then
      raise exception 'Product not found (id %)', v_product_id;
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
-- Quotations (English messages)
-- ---------------------------------------------------------------------
create or replace function public.create_quotation(
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
    raise exception 'Add at least one item';
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

create or replace function public.decide_quotation(p_quotation_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Only an admin or manager can approve quotations';
  end if;
  update public.quotations
  set status = case when p_approve then 'approved'::public.quotation_status else 'rejected'::public.quotation_status end,
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_quotation_id and status = 'pending_approval';
  if not found then
    raise exception 'This quotation is not waiting for approval';
  end if;
end $$;

create or replace function public.set_quotation_status(p_quotation_id bigint, p_status public.quotation_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current public.quotation_status;
begin
  if not public.is_staff() then
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

-- ---------------------------------------------------------------------
-- record_payment: payment date (default today)
-- ---------------------------------------------------------------------
drop function public.record_payment(text, bigint, numeric, public.payment_mode, text);

create function public.record_payment(
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
  v_id bigint;
begin
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
    if not public.is_staff() then raise exception 'Not authorized'; end if;
    select total - amount_received into v_pending from public.sales where id = p_document_id for update;
  elsif p_direction = 'paid' then
    if not public.is_manager() then raise exception 'Only an admin or manager can pay suppliers'; end if;
    select total - amount_paid into v_pending from public.purchases where id = p_document_id for update;
  else
    raise exception 'Direction must be received or paid';
  end if;

  if v_pending is null then
    raise exception 'Invoice not found';
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

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------
-- New column added at the end so dependent views keep working
create or replace view public.product_catalog as
select
  p.id, p.sku, p.name, p.brand, p.model, p.category_id, c.name as category_name, p.specifications,
  p.selling_price, p.min_price, p.stock, p.reorder_level, p.image_path, p.datasheet_path, p.active,
  case when p.stock = 0 then 'out' when p.stock <= p.reorder_level then 'low' else 'ok' end as stock_status,
  p.unit
from public.products p
left join public.categories c on c.id = p.category_id
where public.is_staff();

drop view public.sales_view;
create view public.sales_view with (security_invoker = true) as
select
  s.*,
  coalesce(nullif(c.shop_name, '') || ' (' || c.name || ')', c.name, sp.name, s.walk_in_name, 'Walk-in customer') as party_name,
  coalesce(c.phone, sp.phone, s.walk_in_phone) as party_phone,
  case when c.type = 'Shopkeeper' then 'shopkeeper' when s.customer_id is not null then 'customer'
       when s.supplier_id is not null then 'supplier' else 'walk_in' end as buyer_type,
  coalesce((select sum(i.qty) from public.sale_items i where i.sale_id = s.id), 0) as item_count,
  s.total - s.amount_received as pending,
  case when s.amount_received >= s.total then 'paid' when s.amount_received > 0 then 'partial' else 'unpaid' end as payment_status,
  s.sale_date + s.payment_days as due_date
from public.sales s
left join public.customers c on c.id = s.customer_id
left join public.suppliers sp on sp.id = s.supplier_id;

create or replace view public.payments_view with (security_invoker = true) as
select
  pm.*,
  coalesce(nullif(c.shop_name, '') || ' (' || c.name || ')', c.name, ssp.name, s.walk_in_name, sp.name, 'Walk-in customer') as party_name
from public.payments pm
left join public.sales s on s.id = pm.sale_id
left join public.customers c on c.id = s.customer_id
left join public.suppliers ssp on ssp.id = s.supplier_id
left join public.purchases pu on pu.id = pm.purchase_id
left join public.suppliers sp on sp.id = pu.supplier_id;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on public.sales_view from anon;
grant select on public.sales_view to authenticated;
revoke all on function public.create_sale(text, text, text, text, public.payment_mode, integer, numeric, boolean, jsonb) from anon, public;
revoke all on function public.record_payment(text, bigint, numeric, public.payment_mode, text, date) from anon, public;
grant execute on function public.create_sale(text, text, text, text, public.payment_mode, integer, numeric, boolean, jsonb) to authenticated;
grant execute on function public.record_payment(text, bigint, numeric, public.payment_mode, text, date) to authenticated;

-- Tell the API about the new function signatures
notify pgrst, 'reload schema';
