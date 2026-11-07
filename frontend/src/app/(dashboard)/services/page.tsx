import { Plus } from "lucide-react";
import { Badge, Button, Card, PageHeader, Table, Td } from "@/components/ui";
import { formatPKR, services } from "@/lib/demo-data";

export default function ServicesPage() {
  return (
    <>
      <PageHeader demo
        title="Services"
        description="Services such as installation, surveys and repairs. They have no stock but can be added to invoices."
        actions={<Button icon={Plus}>Add service</Button>}
      />
      <Card>
        <Table head={["Code", "Service", "Unit", "Rate", "Tax"]}>
          {services.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <Td className="font-mono text-xs">{s.code}</Td>
              <Td className="font-medium text-slate-900">{s.name}</Td>
              <Td>{s.unit}</Td>
              <Td className="tabular-nums">{formatPKR(s.rate)}</Td>
              <Td>{s.taxable ? <Badge tone="blue">Taxable</Badge> : <Badge>Exempt</Badge>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
