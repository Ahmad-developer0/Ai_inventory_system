-- AUTO-GENERATED: migrations 0001-0008 + seed, for pasting into a NEW project in one go. Source files are in migrations/.


-- ===================== migrations/0001_core_schema.sql =====================
-- =====================================================================
-- AI Sales Assistant: core business schema
-- Supabase SQL Editor mein poori file aik dafa run karein.
--
-- Rules jo database khud enforce karta hai:
--   * Stock sirf stock_movements se badalta hai (products.stock direct edit nahi ho sakta)
--   * Sale par stock OUT, purchase par stock IN: dono functions ke andar aik transaction mein
--   * Salesperson minimum price se kam par sale nahi kar sakta; quotation approval mangti hai
--   * Purchase price sirf admin/manager dekh sakte hain (product_catalog view mein nahi hai)
-- =====================================================================

create type public.user_role as enum ('admin', 'manager', 'salesperson');
create type public.payment_mode as enum ('Cash', 'Bank Transfer', 'Cheque', 'Due');
create type public.movement_type as enum ('IN', 'OUT', 'ADJUST');
create type public.quotation_status as enum ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected');

-- ---------------------------------------------------------------------
-- Users (Supabase Auth ke saath linked)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null default 'salesperson',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_staff() returns boolean
language sql stable as $$ select public.current_user_role() is not null $$;

create function public.is_manager() returns boolean
language sql stable as $$ select coalesce(public.current_user_role() in ('admin', 'manager'), false) $$;

create function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.current_user_role() = 'admin', false) $$;

-- Naya auth user bane to profile bhi bane. Sab se pehla user admin hota hai.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'salesperson'::public.user_role else 'admin'::public.user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------
create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  parent_id bigint references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  sku text not null unique,
  name text not null,
  brand text,
  model text,
  category_id bigint references public.categories (id) on delete set null,
  specifications text,
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  min_price numeric(12, 2) not null check (min_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  image_path text,
  datasheet_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint min_price_not_above_selling check (min_price <= selling_price)
);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete restrict,
  type public.movement_type not null,
  qty integer not null,
  reference text,
  note text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint qty_sign_matches_type check (
    (type = 'IN' and qty > 0) or (type = 'OUT' and qty < 0) or (type = 'ADJUST' and qty <> 0)
  )
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- Har movement product.stock ko update karta hai. Stock negative nahi ho sakta.
create function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stock integer;
  v_name text;
begin
  select stock, name into v_stock, v_name from public.products where id = new.product_id for update;
  if v_stock + new.qty < 0 then
    raise exception 'Stock kam hai: % (available %, required %)', v_name, v_stock, -new.qty;
  end if;
  update public.products set stock = stock + new.qty where id = new.product_id;
  return new;
end $$;

create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------
create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  city text,
  type text not null default 'Retail' check (type in ('Retail', 'Dealer', 'Installer')),
  notes text,
  opt_out boolean not null default false,
  created_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (lower(name));

create table public.suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  city text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Sales (id hi invoice number hai, 1001 se shuru)
-- ---------------------------------------------------------------------
create table public.sales (
  id bigint generated always as identity (start with 1001) primary key,
  sale_date date not null default current_date,
  customer_id bigint references public.customers (id) on delete restrict,
  walk_in_name text,
  walk_in_phone text,
  payment_mode public.payment_mode not null,
  payment_days integer not null default 0 check (payment_days >= 0),
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  amount_received numeric(14, 2) not null default 0 check (amount_received >= 0),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint received_not_above_total check (amount_received <= total)
);

create table public.sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint not null references public.sales (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null,
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  line_total numeric(14, 2) not null
);

create index sale_items_sale_idx on public.sale_items (sale_id);

-- ---------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------
create table public.purchases (
  id bigint generated always as identity (start with 301) primary key,
  bill_no text,
  supplier_id bigint not null references public.suppliers (id) on delete restrict,
  purchase_date date not null default current_date,
  payment_mode public.payment_mode not null,
  payment_days integer not null default 0 check (payment_days >= 0),
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint paid_not_above_total check (amount_paid <= total)
);

create table public.purchase_items (
  id bigint generated always as identity primary key,
  purchase_id bigint not null references public.purchases (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  line_total numeric(14, 2) not null
);

create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

-- ---------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------
create table public.quotations (
  id bigint generated always as identity (start with 1) primary key,
  customer_id bigint not null references public.customers (id) on delete restrict,
  quote_date date not null default current_date,
  valid_until date not null default (current_date + 7),
  status public.quotation_status not null default 'draft',
  subtotal numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  needs_approval boolean not null default false,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.quotation_items (
  id bigint generated always as identity primary key,
  quotation_id bigint not null references public.quotations (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null,
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  line_total numeric(14, 2) not null,
  below_min boolean not null default false
);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- ---------------------------------------------------------------------
-- Payments (receivables aur payables yahin se update hote hain)
-- ---------------------------------------------------------------------
create table public.payments (
  id bigint generated always as identity primary key,
  payment_date date not null default current_date,
  direction text not null check (direction in ('received', 'paid')),
  sale_id bigint references public.sales (id) on delete restrict,
  purchase_id bigint references public.purchases (id) on delete restrict,
  mode public.payment_mode not null check (mode <> 'Due'),
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint payment_links_one_document check (
    (direction = 'received' and sale_id is not null and purchase_id is null)
    or (direction = 'paid' and purchase_id is not null and sale_id is null)
  )
);

create function public.apply_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'received' then
    update public.sales set amount_received = amount_received + new.amount where id = new.sale_id;
  else
    update public.purchases set amount_paid = amount_paid + new.amount where id = new.purchase_id;
  end if;
  return new;
end $$;

create trigger payments_apply after insert on public.payments
  for each row execute function public.apply_payment();


-- ===================== migrations/0002_business_logic.sql =====================
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


-- ===================== migrations/0003_security.sql =====================
-- =====================================================================
-- Security: Row Level Security aur permissions
--   admin       : sab kuch, users manage
--   manager     : products, purchase price, purchases, stock adjust, approvals
--   salesperson : catalog (bina purchase price), customers, sales, quotations
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.payments enable row level security;

-- profiles
create policy "staff read profiles" on public.profiles for select to authenticated
  using (public.is_staff() or id = auth.uid());
create policy "admin updates profiles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- categories
create policy "staff read categories" on public.categories for select to authenticated using (public.is_staff());
create policy "managers insert categories" on public.categories for insert to authenticated with check (public.is_manager());
create policy "managers update categories" on public.categories for update to authenticated using (public.is_manager());
create policy "managers delete categories" on public.categories for delete to authenticated using (public.is_manager());

-- products: poori table (purchase price ke saath) sirf managers. Baqi staff product_catalog view use karta hai.
create policy "managers read products" on public.products for select to authenticated using (public.is_manager());
create policy "managers insert products" on public.products for insert to authenticated with check (public.is_manager());
create policy "managers update products" on public.products for update to authenticated using (public.is_manager());
create policy "managers delete products" on public.products for delete to authenticated using (public.is_manager());

-- stock_movements: koi update/delete nahi. Ghalti theek karni ho to ADJUST movement.
create policy "staff read movements" on public.stock_movements for select to authenticated using (public.is_staff());
create policy "managers add movements" on public.stock_movements for insert to authenticated
  with check (public.is_manager() and created_by = auth.uid());

-- customers
create policy "staff read customers" on public.customers for select to authenticated using (public.is_staff());
create policy "staff insert customers" on public.customers for insert to authenticated with check (public.is_staff());
create policy "staff update customers" on public.customers for update to authenticated using (public.is_staff());
create policy "managers delete customers" on public.customers for delete to authenticated using (public.is_manager());

-- suppliers
create policy "staff read suppliers" on public.suppliers for select to authenticated using (public.is_staff());
create policy "managers insert suppliers" on public.suppliers for insert to authenticated with check (public.is_manager());
create policy "managers update suppliers" on public.suppliers for update to authenticated using (public.is_manager());
create policy "managers delete suppliers" on public.suppliers for delete to authenticated using (public.is_manager());

-- sales, quotations: sab staff parh sakta hai. Likhna sirf functions (create_sale, create_quotation) se.
create policy "staff read sales" on public.sales for select to authenticated using (public.is_staff());
create policy "staff read sale items" on public.sale_items for select to authenticated using (public.is_staff());
create policy "staff read quotations" on public.quotations for select to authenticated using (public.is_staff());
create policy "staff read quotation items" on public.quotation_items for select to authenticated using (public.is_staff());

-- purchases mein cost price hai: sirf managers
create policy "managers read purchases" on public.purchases for select to authenticated using (public.is_manager());
create policy "managers read purchase items" on public.purchase_items for select to authenticated using (public.is_manager());

-- payments: received sab staff, paid (supplier) sirf managers
create policy "read payments" on public.payments for select to authenticated
  using (public.is_manager() or (direction = 'received' and public.is_staff()));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.categories, public.customers, public.suppliers to authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;
grant insert (product_id, type, qty, reference, note, created_by) on public.stock_movements to authenticated;

-- products.stock sirf stock_movements trigger badal sakta hai
revoke insert, update on public.products from authenticated;
grant insert (sku, name, brand, model, category_id, specifications, purchase_price, selling_price, min_price,
              reorder_level, image_path, datasheet_path, active)
  on public.products to authenticated;
grant update (sku, name, brand, model, category_id, specifications, purchase_price, selling_price, min_price,
              reorder_level, image_path, datasheet_path, active)
  on public.products to authenticated;
grant delete on public.products to authenticated;

grant execute on function
  public.current_user_role(), public.is_staff(), public.is_manager(), public.is_admin(), public.tax_rate(),
  public.create_sale(bigint, text, text, public.payment_mode, integer, numeric, boolean, jsonb),
  public.create_purchase(bigint, text, public.payment_mode, integer, numeric, boolean, jsonb),
  public.create_quotation(bigint, integer, boolean, text, jsonb),
  public.decide_quotation(bigint, boolean),
  public.set_quotation_status(bigint, public.quotation_status),
  public.record_payment(text, bigint, numeric, public.payment_mode, text),
  public.dashboard_stats()
to authenticated;


-- ===================== migrations/0004_storage.sql =====================
-- =====================================================================
-- Product images aur datasheets ke liye Supabase Storage bucket
-- Parhna public hai (link se), upload/delete sirf admin/manager.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', true)
on conflict (id) do nothing;

create policy "managers upload product files" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-files' and public.is_manager());

create policy "managers update product files" on storage.objects for update to authenticated
  using (bucket_id = 'product-files' and public.is_manager());

create policy "managers delete product files" on storage.objects for delete to authenticated
  using (bucket_id = 'product-files' and public.is_manager());


-- ===================== seed.sql =====================
-- Starter data: categories, products (opening stock ke saath), customers, suppliers.
-- Migrations ke baad aik dafa run karein. Apna asli data baad mein Products page ya Bulk Upload se daalein.

insert into public.categories (name) values
  ('Solar Inverters'), ('VFDs'), ('Batteries'), ('Cables'), ('Electrical Accessories');

insert into public.categories (name, parent_id) values
  ('Hybrid Inverters', (select id from public.categories where name = 'Solar Inverters')),
  ('Lithium Batteries', (select id from public.categories where name = 'Batteries'));

insert into public.products (sku, name, brand, model, category_id, specifications, purchase_price, selling_price, min_price, reorder_level)
select v.sku, v.name, v.brand, v.model, c.id, v.specs, v.cost, v.price, v.min_price, v.reorder
from (values
  ('INV-HYB-6K', 'Hybrid Inverter 6kW', 'Growatt', 'SPF 6000 ES Plus', 'Hybrid Inverters', 'Rated power: 6kW
Battery voltage: 48V
PV input: 500V DC max', 198000, 228000, 215000, 5),
  ('INV-HYB-10K', 'Hybrid Inverter 10kW', 'Inverex', 'Nitrox 10kW', 'Hybrid Inverters', 'Rated power: 10kW
Battery voltage: 48V', 345000, 392000, 370000, 4),
  ('INV-ONG-15K', 'On-Grid Inverter 15kW', 'Huawei', 'SUN2000-15KTL-M2', 'Solar Inverters', 'Rated power: 15kW
Output: 3-phase 400V', 410000, 465000, 440000, 2),
  ('VFD-7.5-3P', 'VFD 7.5kW (3-phase in)', 'INVT', 'GD20-7R5G-4', 'VFDs', 'Motor: 7.5kW / 10HP
Input: 3-phase 380V
Output: 3-phase 380V', 88000, 104000, 97000, 3),
  ('VFD-2.2-1P', 'VFD 2.2kW (1-phase in, 3-phase out)', 'Delta', 'VFD22EL21A', 'VFDs', 'Motor: 2.2kW / 3HP
Input: 1-phase 220V
Output: 3-phase 220V (motor delta connection)', 36000, 43500, 40000, 3),
  ('VFD-SOL-15', 'Solar Pump VFD 15kW', 'INVT', 'GD100-PV 15kW', 'VFDs', 'Motor: 15kW / 20HP
Input: PV DC or 3-phase AC 380V
MPPT built-in', 152000, 178000, 168000, 2),
  ('BAT-LI-5K', 'Lithium Battery 5.12kWh', 'Pylontech', 'US5000', 'Lithium Batteries', 'Voltage: 48V (51.2V nominal)
Capacity: 100Ah
Cycle life: 6000+', 255000, 289000, 275000, 4),
  ('BAT-TUB-200', 'Tubular Battery 200Ah', 'Phoenix', 'TX-2500', 'Batteries', '12V 200Ah lead-acid tubular', 58000, 66500, 63000, 8),
  ('CAB-DC-6', 'Solar DC Cable 6mm² (100m)', 'Fast Cables', 'PV1-F 6mm²', 'Cables', '6mm² tinned copper, 1500V DC, 100m roll', 31000, 36500, 34500, 10),
  ('CAB-AC-4C10', 'Copper Cable 4-core 10mm² (per m)', 'Pakistan Cables', '4C x 10mm²', 'Cables', '4-core 10mm² copper, PVC armoured, per meter', 1450, 1720, 1640, 200),
  ('ACC-MCB-32', 'DC MCB 32A 2-pole', 'Tomzn', 'TOB1Z-63', 'Electrical Accessories', '32A, 550V DC, 2-pole', 1150, 1500, 1350, 25),
  ('ACC-SPD-DC', 'DC Surge Protector', 'Tomzn', 'TOV1-40PV', 'Electrical Accessories', '1000V DC, 40kA', 2300, 2950, 2700, 15)
) as v(sku, name, brand, model, category, specs, cost, price, min_price, reorder)
join public.categories c on c.name = v.category;

-- Opening stock: stock hamesha movement se aata hai
insert into public.stock_movements (product_id, type, qty, reference, created_by)
select p.id, 'IN', v.qty, 'Opening stock', null
from (values
  ('INV-HYB-6K', 14), ('INV-HYB-10K', 3), ('INV-ONG-15K', 6), ('VFD-7.5-3P', 9), ('VFD-SOL-15', 4),
  ('BAT-LI-5K', 11), ('BAT-TUB-200', 22), ('CAB-DC-6', 40), ('CAB-AC-4C10', 650), ('ACC-MCB-32', 6), ('ACC-SPD-DC', 34)
) as v(sku, qty)
join public.products p on p.sku = v.sku;
-- VFD-2.2-1P jaan boojh kar 0 stock par hai (out-of-stock alert test karne ke liye)

insert into public.customers (name, phone, city, type) values
  ('Bilal Solar Solutions', '+92 300 1234567', 'Lahore', 'Installer'),
  ('Haji Rashid Farms', '+92 301 7654321', 'Okara', 'Retail'),
  ('Al-Noor Electric Store', '+92 321 5558899', 'Faisalabad', 'Dealer'),
  ('Sana Textile Mills', '+92 333 4441122', 'Kasur', 'Retail');

insert into public.suppliers (name, phone, city, notes) values
  ('Growatt Pakistan Distributor', '+92 42 3588 1100', 'Lahore', 'Hybrid inverters'),
  ('INVT Drives Karachi', '+92 21 3456 7788', 'Karachi', 'VFDs, solar pump drives'),
  ('Pylontech Authorized Dealer', '+92 51 2223 4455', 'Islamabad', 'Lithium batteries'),
  ('Hall Road Accessories', '+92 300 8889911', 'Lahore', 'MCBs, SPDs, connectors');


-- ===================== migrations/0005_sales_update.sql =====================
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


-- ===================== migrations/0006_product_images.sql =====================
-- =====================================================================
-- 0006: Multiple images per product
--   * product_images: up to 8 photos per product, ordered; position 0 is the cover
--   * products.image_path stays as the cover image (used by lists and the PDF)
--   * product_catalog gets an "images" column so the AI agent can send photos to customers
-- Run once in the Supabase SQL Editor.
-- =====================================================================

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);

-- Limit: 8 photos per product
create function public.check_product_image_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id) >= 8 then
    raise exception 'A product can have at most 8 images';
  end if;
  return new;
end $$;

create trigger product_images_limit before insert on public.product_images
  for each row execute function public.check_product_image_limit();

-- Existing single images become the first photo
insert into public.product_images (product_id, path, position)
select id, image_path, 0 from public.products where image_path is not null;

alter table public.product_images enable row level security;

create policy "staff read product images" on public.product_images for select to authenticated using (public.is_staff());
create policy "managers add product images" on public.product_images for insert to authenticated with check (public.is_manager());
create policy "managers update product images" on public.product_images for update to authenticated using (public.is_manager());
create policy "managers delete product images" on public.product_images for delete to authenticated using (public.is_manager());

revoke all on public.product_images from anon;
grant select, insert, update, delete on public.product_images to authenticated;

-- Catalog (no purchase price) with all image paths in order; new column at the end
create or replace view public.product_catalog as
select
  p.id, p.sku, p.name, p.brand, p.model, p.category_id, c.name as category_name, p.specifications,
  p.selling_price, p.min_price, p.stock, p.reorder_level, p.image_path, p.datasheet_path, p.active,
  case when p.stock = 0 then 'out' when p.stock <= p.reorder_level then 'low' else 'ok' end as stock_status,
  p.unit,
  coalesce((select array_agg(i.path order by i.position, i.id) from public.product_images i where i.product_id = p.id), '{}') as images
from public.products p
left join public.categories c on c.id = p.category_id
where public.is_staff();

notify pgrst, 'reload schema';


-- ===================== migrations/0007_sale_less_amount.sql =====================
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


-- ===================== migrations/0008_agent_role_and_security.sql =====================
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
