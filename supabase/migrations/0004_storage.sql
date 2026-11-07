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
