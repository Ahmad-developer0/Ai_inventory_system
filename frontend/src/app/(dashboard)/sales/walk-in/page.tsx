import { ShoppingCart } from "lucide-react";
import { Alert, Card, EmptyRow, LinkButton, PageHeader, Table, Td } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPKR } from "@/lib/format";
import type { SaleViewRow } from "@/lib/types";

export default async function WalkInPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_view").select("*").eq("buyer_type", "walk_in").order("id", { ascending: false }).limit(200);
  const rows = (data ?? []) as SaleViewRow[];

  return (
    <>
      <PageHeader
        title="Walk-in Customers"
        description="Counter customers. Name and WhatsApp number are saved with every sale; unpaid amounts also show in Receivables."
        actions={
          <LinkButton href="/sales/pos" variant="teal" icon={ShoppingCart}>
            POS Sales
          </LinkButton>
        }
      />
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <Card>
          <Table head={["Invoice", "Date", "Name", "WhatsApp / phone", "Items", "Total", "Pending", "Mode"]}>
            {rows.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">{w.id}</Td>
                <Td>{formatDate(w.sale_date)}</Td>
                <Td>{w.walk_in_name ?? "—"}</Td>
                <Td className="tabular-nums">{w.walk_in_phone ?? "—"}</Td>
                <Td className="tabular-nums">{w.item_count}</Td>
                <Td className="font-medium tabular-nums">{formatPKR(w.total)}</Td>
                <Td className={`tabular-nums ${Number(w.pending) > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{formatPKR(w.pending)}</Td>
                <Td>{w.payment_mode}</Td>
              </tr>
            ))}
          </Table>
          {rows.length === 0 && <EmptyRow>No walk-in sales yet.</EmptyRow>}
        </Card>
      )}
    </>
  );
}
