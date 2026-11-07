export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;

export const PRODUCT_FILES_BUCKET = "product-files";

export function publicFileUrl(path: string | null): string | null {
  return path ? `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_FILES_BUCKET}/${path}` : null;
}
