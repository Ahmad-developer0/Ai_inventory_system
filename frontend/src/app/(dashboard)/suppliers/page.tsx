import { Alert, PageHeader } from "@/components/ui";
import { RecordManager } from "@/components/record-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";
import { num, type Supplier } from "@/lib/types";

export default async function SuppliersPage() {
  await requireManager();
  const supabase = await createClient();
  const [{ data: suppliers, error }, { data: purchases }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("purchases").select("supplier_id, total, amount_paid"),
  ]);

  const payable = new Map<number, number>();
  for (const p of purchases ?? []) payable.set(p.supplier_id, (payable.get(p.supplier_id) ?? 0) + num(p.total) - num(p.amount_paid));

  const rows = ((suppliers ?? []) as Supplier[]).map((s) => ({ ...s, payable: formatPKR(payable.get(s.id) ?? 0) }));

  return (
    <>
      <PageHeader title="Suppliers" description="Distributors and wholesalers you buy from. Click a name to see what you bought, at what rate, and what is still payable." />
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <RecordManager
          table="suppliers"
          noun="Supplier"
          rows={rows}
          canEdit
          canDelete
          linkPrefix="/suppliers"
          columns={[
            { key: "name", label: "Supplier" },
            { key: "contact_name", label: "Contact person" },
            { key: "phone", label: "Phone" },
            { key: "city", label: "City" },
            { key: "notes", label: "Products / notes" },
            { key: "payable", label: "Payable" },
          ]}
          fields={[
            { key: "name", label: "Company / shop name", required: true },
            { key: "contact_name", label: "Contact person" },
            { key: "phone", label: "Phone", type: "tel" },
            { key: "city", label: "City" },
            { key: "notes", label: "Products / notes", type: "textarea" },
          ]}
        />
      )}
    </>
  );
}
