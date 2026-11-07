import { Alert, PageHeader } from "@/components/ui";
import { ProductsManager } from "./products-manager";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CatalogProduct, Category, Product } from "@/lib/types";

export default async function ProductsPage() {
  const profile = await getProfile();
  const manager = isManagerRole(profile);
  const supabase = await createClient();

  const [{ data: catalog, error }, { data: categories }, { data: costs }] = await Promise.all([
    supabase.from("product_catalog").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    // Purchase price sirf manager ko milti hai (RLS salesperson ke liye khali list deta hai)
    manager ? supabase.from("products").select("id, purchase_price") : Promise.resolve({ data: [] }),
  ]);

  const costById = new Map((costs ?? []).map((c: { id: number; purchase_price: number }) => [c.id, c.purchase_price]));
  const products: Product[] = ((catalog ?? []) as CatalogProduct[]).map((p) => ({ ...p, purchase_price: costById.get(p.id) ?? null }));

  return (
    <>
      <PageHeader
        title="Products"
        description={manager ? "Product catalog, pricing and stock. Only admins and managers can see purchase cost." : "Product catalog and live stock."}
      />
      {error ? <Alert tone="error">{error.message}</Alert> : <ProductsManager products={products} categories={(categories ?? []) as Category[]} canEdit={manager} />}
    </>
  );
}
