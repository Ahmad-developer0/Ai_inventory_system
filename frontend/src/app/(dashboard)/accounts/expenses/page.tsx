import { Plus } from "lucide-react";
import { Badge, Button, Card, PageHeader, Table, Td } from "@/components/ui";
import { expenses, formatPKR } from "@/lib/demo-data";

export default function ExpensesPage() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <PageHeader demo
        title="Expenses"
        description={`Shop expenses: rent, electricity, transport, salaries. This month: ${formatPKR(total)}`}
        actions={<Button icon={Plus}>Add expense</Button>}
      />
      <Card>
        <Table head={["Date", "Category", "Description", "Paid by", "Amount"]}>
          {expenses.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <Td>{e.date}</Td>
              <Td>
                <Badge>{e.category}</Badge>
              </Td>
              <Td className="text-slate-700">{e.description}</Td>
              <Td>{e.paidBy}</Td>
              <Td className="tabular-nums font-medium">{formatPKR(e.amount)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
