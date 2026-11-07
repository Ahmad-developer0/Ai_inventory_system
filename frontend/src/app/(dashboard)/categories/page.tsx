import { Alert, PageHeader } from "@/components/ui";
import { RecordManager } from "@/components/record-manager";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function CategoriesPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const [{ data: categories, error }, { data: catalog }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("product_catalog").select("category_id"),
  ]);

  const list = (categories ?? []) as Category[];
  const nameById = new Map(list.map((c) => [c.id, c.name]));
  const counts = new Map<number, number>();
  for (const p of catalog ?? []) if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);

  const rows = list.map((c) => ({
    ...c,
    parent_id: c.parent_id ? String(c.parent_id) : "",
    parent_name: c.parent_id ? nameById.get(c.parent_id) : null,
    product_count: counts.get(c.id) ?? 0,
  }));

  return (
    <>
      <PageHeader title="Categories" description="Product categories and sub-categories." />
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <RecordManager
          table="categories"
          noun="Category"
          rows={rows}
          canEdit={isManagerRole(profile)}
          canDelete={isManagerRole(profile)}
          columns={[
            { key: "name", label: "Category" },
            { key: "parent_name", label: "Parent" },
            { key: "product_count", label: "Products" },
          ]}
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "parent_id", label: "Parent category", type: "select", options: [{ value: "", label: "— (top level)" }, ...list.map((c) => ({ value: String(c.id), label: c.name }))] },
          ]}
        />
      )}
    </>
  );
}
