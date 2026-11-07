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
