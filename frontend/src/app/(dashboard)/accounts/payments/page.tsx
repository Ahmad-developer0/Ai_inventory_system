import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Alert, Badge, Card, EmptyRow, PageHeader, StatCard, Table, Td } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPKR } from "@/lib/format";
import { num, type PaymentViewRow } from "@/lib/types";

export default async function PaymentsPage() {
  const supabase = await createClient();
  // RLS: salesperson ko sirf received payments milti hain
  const { data, error } = await supabase.from("payments_view").select("*").order("id", { ascending: false }).limit(300);
  const payments = (data ?? []) as PaymentViewRow[];
  const received = payments.filter((p) => p.direction === "received").reduce((s, p) => s + num(p.amount), 0);
  const paid = payments.filter((p) => p.direction === "paid").reduce((s, p) => s + num(p.amount), 0);

  return (
    <>
      <PageHeader title="Payments" description="Payments received from customers and paid to suppliers. Record new payments from Receivables or Payables." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Received" value={formatPKR(received)} icon={ArrowDownLeft} tone="green" />
        <StatCard label="Paid" value={formatPKR(paid)} icon={ArrowUpRight} tone="red" />
      </div>
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <Card>
          <Table head={["Date", "Type", "Party", "Invoice", "Mode", "Reference", "Amount"]}>
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td>{formatDate(p.payment_date)}</Td>
                <Td>{p.direction === "received" ? <Badge tone="green">Received</Badge> : <Badge tone="red">Paid</Badge>}</Td>
                <Td className="font-medium text-slate-900">{p.party_name}</Td>
                <Td>{p.sale_id ? `Sale #${p.sale_id}` : `Purchase #${p.purchase_id}`}</Td>
                <Td>{p.mode}</Td>
                <Td className="font-mono text-xs">{p.reference ?? "—"}</Td>
                <Td className={`font-medium tabular-nums ${p.direction === "received" ? "text-emerald-700" : "text-red-600"}`}>
                  {p.direction === "received" ? "+" : "−"}
                  {formatPKR(p.amount)}
                </Td>
              </tr>
            ))}
          </Table>
          {payments.length === 0 && <EmptyRow>No payments yet.</EmptyRow>}
        </Card>
      )}
    </>
  );
}
