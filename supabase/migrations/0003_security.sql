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
