import { BadgePercent, Lock, TrendingUp, Wallet } from "lucide-react";
import { Card, PageHeader, StatCard, Table, Td } from "@/components/ui";
import { formatPKR, products } from "@/lib/demo-data";

const topProducts = [
  { sku: "BAT-LI-5K", units: 38 },
  { sku: "INV-HYB-6K", units: 31 },
  { sku: "VFD-SOL-15", units: 17 },
  { sku: "CAB-DC-6", units: 64 },
  { sku: "ACC-SPD-DC", units: 120 },
].map((t) => {
  const p = products.find((x) => x.sku === t.sku)!;
  return { ...t, name: p.name, revenue: t.units * p.sellingPrice, profit: t.units * (p.sellingPrice - p.purchasePrice) };
});

export default function ReportsPage() {
  return (
    <>
      <PageHeader demo title="Reports" description="Sales, conversion and profit. Only admins and managers see profit." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue (October)" value="Rs 12.6M" icon={TrendingUp} tone="green" />
        <StatCard label="Gross profit (October)" value="Rs 1.71M" hint="13.6% margin" icon={Wallet} tone="blue" />
        <StatCard label="Quotation → order" value="34%" hint="AI quotations: 38%" icon={BadgePercent} tone="amber" />
      </div>

      <Card title="Top products (October)" action={<span className="flex items-center gap-1 text-xs text-slate-500"><Lock size={12} /> Admin / Manager</span>}>
        <Table head={["Product", "Units sold", "Revenue", "Gross profit"]}>
          {topProducts.map((t) => (
            <tr key={t.sku}>
              <Td>
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="font-mono text-xs text-slate-500">{t.sku}</p>
              </Td>
              <Td className="tabular-nums">{t.units}</Td>
              <Td className="tabular-nums">{formatPKR(t.revenue)}</Td>
              <Td className="tabular-nums font-medium text-emerald-700">{formatPKR(t.profit)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
