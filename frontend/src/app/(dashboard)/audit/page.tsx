import { Alert, Badge, Card, EmptyRow, PageHeader, Table, Td } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

interface AuditRow {
  id: number;
  created_at: string;
  user_id: string | null;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete";
  changes: Record<string, unknown> | null;
}

const LABELS: Record<string, string> = {
  products: "Product",
  profiles: "User",
  customers: "Customer",
  suppliers: "Supplier",
  payments: "Payment",
  quotations: "Quotation",
};

// "selling_price: 2950 → 3000" jaisi aasaan lines
function describe(row: AuditRow): string {
  const c = row.changes ?? {};
  if (row.action === "update") {
    return Object.entries(c)
      .map(([k, v]) => {
        const { from, to } = v as { from: unknown; to: unknown };
        return `${k.replace(/_/g, " ")}: ${String(from ?? "—")} → ${String(to ?? "—")}`;
      })
      .join(" · ");
  }
  const name = (c.name ?? c.email ?? c.reference ?? "") as string;
  if (row.table_name === "payments") return `${c.direction === "paid" ? "Paid" : "Received"} Rs ${Number(c.amount ?? 0).toLocaleString("en-PK")} (${c.mode ?? ""})`;
  return name ? String(name) : "";
}

export default async function AuditLogPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data, error }, { data: people }] = await Promise.all([
    supabase.from("audit_logs").select("*").order("id", { ascending: false }).limit(300),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const nameById = new Map((people ?? []).map((p: { id: string; full_name: string; email: string | null }) => [p.id, p.full_name || p.email || "—"]));
  const rows = (data ?? []) as AuditRow[];

  return (
    <>
      <PageHeader title="Audit Log" description="Who changed prices, roles and payments, and who deleted records. Only admins can see this; nobody can edit it." />
      {error ? (
        <Alert tone="error">{error.message.includes("audit_logs") ? "Run migration 0008 to enable the audit log." : error.message}</Alert>
      ) : (
        <Card>
          <Table head={["When", "Who", "What", "Action", "Details"]} colWidths={["16%", "16%", "14%", "10%", "44%"]}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td>{formatDateTime(r.created_at)}</Td>
                <Td>{r.user_id ? (nameById.get(r.user_id) ?? "Removed user") : "System"}</Td>
                <Td>
                  {LABELS[r.table_name] ?? r.table_name} #{r.record_id}
                </Td>
                <Td>
                  <Badge tone={r.action === "delete" ? "red" : r.action === "update" ? "amber" : "green"}>{r.action}</Badge>
                </Td>
                <Td className="whitespace-normal text-slate-600">{describe(r)}</Td>
              </tr>
            ))}
          </Table>
          {rows.length === 0 && <EmptyRow>No changes recorded yet.</EmptyRow>}
        </Card>
      )}
    </>
  );
}
