import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import { Card, PageHeader, StatCard, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { formatPKR, purchaseInvoices, salesInvoices, TAX_RATE, type InvoiceRow } from "@/lib/demo-data";

// Demo totals tax-inclusive hain, is liye tax = total × rate / (1 + rate)
const taxOf = (r: InvoiceRow) => (r.taxable ? (r.total * TAX_RATE) / (1 + TAX_RATE) : 0);

export default function TaxReportPage() {
  const outputTax = salesInvoices.reduce((s, r) => s + taxOf(r), 0);
  const inputTax = purchaseInvoices.reduce((s, r) => s + taxOf(r), 0);
  const net = outputTax - inputTax;

  const rows = [
    ...salesInvoices.map((r) => ({ type: "Sale", ...r })),
    ...purchaseInvoices.map((r) => ({ type: "Purchase", ...r })),
  ]
    .filter((r) => r.taxable)
    .sort((a, b) => b.date.localeCompare(a.date));

  const exportRows = rows.map((r) => ({
    Type: r.type,
    Date: r.date,
    "Invoice No": r.no,
    Party: r.party,
    "Value excl. tax": Math.round(r.total - taxOf(r)),
    "Sales tax": Math.round(taxOf(r)),
    Total: r.total,
  }));

  return (
    <>
      <PageHeader demo
        title="Sales Tax Report"
        description={`October 2026 · Sales tax ${TAX_RATE * 100}%. Output tax (sales) minus input tax (purchases) = tax payable.`}
        actions={<ExportButtons rows={exportRows} filename="sales-tax-october-2026" />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Output tax (sales)" value={formatPKR(outputTax)} icon={ArrowUpRight} tone="amber" />
        <StatCard label="Input tax (purchases)" value={formatPKR(inputTax)} icon={ArrowDownLeft} tone="blue" />
        <StatCard
          label={net >= 0 ? "Net tax payable" : "Carry forward (refundable)"}
          value={formatPKR(Math.abs(net))}
          icon={Landmark}
          tone={net >= 0 ? "red" : "green"}
        />
      </div>
      <Card title="Taxable invoices">
        <Table head={["Type", "Date", "Invoice", "Party", "Value excl. tax", "Sales tax", "Total"]}>
          {rows.map((r) => (
            <tr key={`${r.type}-${r.no}`} className="hover:bg-slate-50">
              <Td>{r.type}</Td>
              <Td>{r.date}</Td>
              <Td className="font-medium text-slate-900">{r.no}</Td>
              <Td>{r.party}</Td>
              <Td className="tabular-nums">{formatPKR(r.total - taxOf(r))}</Td>
              <Td className="tabular-nums font-medium">{formatPKR(taxOf(r))}</Td>
              <Td className="tabular-nums">{formatPKR(r.total)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
