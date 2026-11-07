import { Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { formatPKR, proformaInvoices } from "@/lib/demo-data";

const statusTone = { open: "blue", converted: "green", expired: "gray" } as const;

export default function ProformaPage() {
  return (
    <>
      <PageHeader demo
        title="Proforma Invoice"
        description="Proforma for advance payment or LC. Converts to a sales invoice once the customer confirms."
      />
      <Card>
        <Table head={["Proforma No", "Date", "Customer", "Total", "Valid till", "Status", ""]}>
          {proformaInvoices.map((p) => (
            <tr key={p.no} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">{p.no}</Td>
              <Td>{p.date}</Td>
              <Td>{p.customer}</Td>
              <Td className="tabular-nums">{formatPKR(p.total)}</Td>
              <Td>{p.validTill}</Td>
              <Td>
                <Badge tone={statusTone[p.status]}>{p.status}</Badge>
              </Td>
              <Td>
                {p.status === "open" && <button className="text-sm font-medium text-amber-600 hover:underline">Convert to invoice</button>}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
