import { Badge, Card, Table, Td } from "@/components/ui";
import { formatPKR, type ReturnNote } from "@/lib/demo-data";

export function ReturnNotesTable({ rows, partyLabel, invoiceLabel }: { rows: ReturnNote[]; partyLabel: string; invoiceLabel: string }) {
  return (
    <Card>
      <Table head={["Note No", "Date", partyLabel, invoiceLabel, "Reason", "Amount", "Stock"]}>
        {rows.map((r) => (
          <tr key={r.no} className="hover:bg-slate-50">
            <Td className="font-medium text-slate-900">{r.no}</Td>
            <Td>{r.date}</Td>
            <Td>{r.party}</Td>
            <Td>{r.againstInvoice}</Td>
            <Td className="max-w-xs whitespace-normal text-slate-600">{r.reason}</Td>
            <Td className="tabular-nums font-medium">{formatPKR(r.amount)}</Td>
            <Td>{r.restocked ? <Badge tone="green">Restocked</Badge> : <Badge tone="red">Damaged / not restocked</Badge>}</Td>
          </tr>
        ))}
      </Table>
      {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No returns.</p>}
    </Card>
  );
}
