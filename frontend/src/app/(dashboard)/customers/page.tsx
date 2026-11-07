import { Alert, PageHeader } from "@/components/ui";
import { RecordManager } from "@/components/record-manager";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";
import { num, type Customer } from "@/lib/types";

export default async function CustomersPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const [{ data: customers, error }, { data: sales }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("sales").select("customer_id, total, amount_received").not("customer_id", "is", null),
  ]);

  const totals = new Map<number, { purchases: number; pending: number }>();
  for (const s of sales ?? []) {
    const t = totals.get(s.customer_id) ?? { purchases: 0, pending: 0 };
    t.purchases += num(s.total);
    t.pending += num(s.total) - num(s.amount_received);
    totals.set(s.customer_id, t);
  }

  const rows = ((customers ?? []) as Customer[]).map((c) => {
    const t = totals.get(c.id);
    return {
      ...c,
      total_purchases: formatPKR(t?.purchases ?? 0),
      pending: formatPKR(t?.pending ?? 0),
      status: !t ? "No purchases" : t.pending > 0 ? "Pending" : "Fully paid",
    };
  });

  return (
    <>
      <PageHeader title="Customers" description="Customers and shopkeepers. Filter by payment status, or click a name to see goods, bills, payments and the ledger." />
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <RecordManager
          table="customers"
          noun="Customer"
          rows={rows}
          canEdit
          canDelete={isManagerRole(profile)}
          searchPlaceholder="Search by name, phone or city…"
          linkPrefix="/customers"
          filters={[
            { key: "status", label: "Payment", options: ["Pending", "Fully paid", "No purchases"] },
            { key: "type", label: "Type", options: ["Shopkeeper", "Retail", "Dealer", "Installer"] },
          ]}
          columns={[
            { key: "name", label: "Customer" },
            { key: "shop_name", label: "Shop" },
            { key: "phone", label: "Phone / WhatsApp" },
            { key: "city", label: "City" },
            { key: "type", label: "Type", badge: { Shopkeeper: "amber", Dealer: "violet", Installer: "blue", Retail: "gray" } },
            { key: "total_purchases", label: "Total purchases" },
            { key: "pending", label: "Pending" },
            { key: "status", label: "Payment", badge: { Pending: "red", "Fully paid": "green", "No purchases": "gray" } },
            { key: "opt_out", label: "Marketing", bool: ["Opted out", "Subscribed"] },
          ]}
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "shop_name", label: "Shop name (for shopkeepers)" },
            { key: "phone", label: "Phone / WhatsApp", type: "tel", placeholder: "+92 300 1234567" },
            { key: "city", label: "City" },
            {
              key: "type",
              label: "Type",
              type: "select",
              options: ["Shopkeeper", "Retail", "Dealer", "Installer"].map((t) => ({ value: t, label: t })),
            },
            { key: "notes", label: "Notes", type: "textarea" },
            { key: "opt_out", label: "Marketing messages band (opt-out)", type: "checkbox" },
          ]}
        />
      )}
    </>
  );
}
