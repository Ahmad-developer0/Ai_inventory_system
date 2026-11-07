-- =====================================================================
-- 0007: "Less" on a sale (bill-level discount / round-off)
--   Bill Rs 3,440, customer pays Rs 3,400 -> Rs 40 can be written off as "Less"
--   instead of staying pending. A salesperson cannot "less" the bill below the
--   products' minimum prices; managers can.
-- Run once in the Supabase SQL Editor.
-- =====================================================================

alter table public.sales add column less_amount numeric(14, 2) not null default 0 check (less_amount >= 0);

drop function public.create_sale(text, text, text, text, public.payment_mode, integer, numeric, boolean, jsonb);

create function public.create_sale(
  p_buyer_type text,
  p_name text,
  p_shop_name text,
  p_phone text,
  p_payment_mode public.payment_mode,
  p_payment_days integer,
  p_amount_received numeric,
  p_apply_tax boolean,
  p_items jsonb,
  p_less_amount numeric default 0
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := public.current_user_role();
  v_key text := public.phone_key(p_phone);
  v_name text := nullif(trim(p_name), '');
  v_shop text := nullif(trim(p_shop_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_less numeric := round(greatest(coalesce(p_less_amount, 0), 0), 2);
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
  v_min_total numeric := 0;
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
      update public.customers set shop_name = coalesce(nullif(shop_name, ''), v_shop) where id = v_customer_id;
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
      update public.suppliers set contact_name = coalesce(nullif(contact_name, ''), v_name) where id = v_supplier_id;
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
    v_min_total := v_min_total + v_product.min_price * v_qty;
  end loop;

  v_tax := case when p_apply_tax then round(v_subtotal * public.tax_rate(), 2) else 0 end;
  if v_less > v_subtotal + v_tax then
    raise exception 'Less amount cannot be more than the bill';
  end if;
  if v_role = 'salesperson' and v_subtotal - v_less < v_min_total then
    raise exception 'Less amount takes the bill below the minimum prices (max Rs % less). Ask a manager.',
      greatest(v_subtotal - v_min_total, 0);
  end if;
  v_total := v_subtotal + v_tax - v_less;
  update public.sales set subtotal = v_subtotal, tax = v_tax, less_amount = v_less, total = v_total where id = v_sale_id;

  v_received := case when p_payment_mode = 'Due' then 0
                     else least(greatest(coalesce(p_amount_received, v_total), 0), v_total) end;
  if v_received > 0 then
    insert into public.payments (direction, sale_id, mode, amount, reference, created_by)
    values ('received', v_sale_id, p_payment_mode, v_received, 'SALE-' || v_sale_id, auth.uid());
  end if;

  return v_sale_id;
end $$;

-- sales_view uses s.*, so recreate it to include less_amount
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

revoke all on public.sales_view from anon;
grant select on public.sales_view to authenticated;
revoke all on function public.create_sale(text, text, text, text, public.payment_mode, integer, numeric, boolean, jsonb, numeric) from anon, public;
grant execute on function public.create_sale(text, text, text, text, public.payment_mode, integer, numeric, boolean, jsonb, numeric) to authenticated;

notify pgrst, 'reload schema';
