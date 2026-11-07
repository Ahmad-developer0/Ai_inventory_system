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
