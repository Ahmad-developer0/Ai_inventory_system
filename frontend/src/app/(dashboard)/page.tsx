import Link from "next/link";
import { AlertTriangle, FileText, HandCoins, TrendingUp } from "lucide-react";
import { Alert, Card, EmptyRow, PageHeader, StatCard, Table, Td, Truncate } from "@/components/ui";
import { PaymentStatusBadge, QuotationStatusBadge, StockBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";
import { qtyWithUnit } from "@/lib/units";
import { num, type CatalogProduct, type DashboardStats, type QuotationViewRow, type SaleViewRow } from "@/lib/types";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const supabase = await createClient();
  const [{ data: stats, error }, { data: sales }, { data: quotes }, { data: lowStock }] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase.from("sales_view").select("*").order("id", { ascending: false }).limit(5),
    supabase.from("quotations_view").select("*").order("id", { ascending: false }).limit(5),
    supabase.from("product_catalog").select("*").eq("active", true).in("stock_status", ["low", "out"]).order("stock").limit(8),
  ]);

  if (error || !stats) return <Alert tone="error">Could not load the dashboard: {error?.message}</Alert>;
  const s = stats as DashboardStats;
  const monthly = s.monthly ?? [];
  const maxSales = Math.max(1, ...monthly.map((m) => num(m.total)));
  const growth = num(s.sales_last_month) > 0 ? ((num(s.sales_this_month) - num(s.sales_last_month)) / num(s.sales_last_month)) * 100 : null;

  return (
    <>
      {denied && (
        <div className="mb-4">
          <Alert tone="error">Only an admin or manager can open that page.</Alert>
        </div>
      )}
      <PageHeader title="Dashboard" description="Today's overview: sales, quotations, receivables and stock." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales this month"
          value={formatPKR(s.sales_this_month)}
          hint={growth === null ? `${s.sales_today} invoices today` : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs last month`}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard label="Open quotations" value={String(s.open_quotations)} hint={`${s.pending_approvals} awaiting approval`} icon={FileText} tone="blue" />
        <StatCard
          label="Receivables"
          value={formatPKR(s.receivables)}
          hint={s.payables !== null ? `Payables: ${formatPKR(s.payables)}` : "Owed by customers"}
          icon={HandCoins}
          tone="amber"
        />
        <StatCard label="Low / out of stock" value={`${s.low_stock} / ${s.out_of_stock}`} hint="At or below reorder level" icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Monthly sales (last 6 months)" className="xl:col-span-2">
          <div className="flex h-56 items-end gap-3 px-5 pb-5 pt-6">
            {monthly.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs tabular-nums text-slate-500">{num(m.total) >= 1e6 ? `${(num(m.total) / 1e6).toFixed(1)}M` : `${Math.round(num(m.total) / 1000)}k`}</span>
                <div className="w-full max-w-12 rounded-t-md bg-amber-500" style={{ height: `${Math.max(2, (num(m.total) / maxSales) * 150)}px` }} />
                <span className="text-xs text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Stock alerts" action={<Link href="/inventory" className="text-xs text-amber-600 hover:underline">Inventory →</Link>}>
          {(lowStock ?? []).length === 0 ? (
            <EmptyRow>All stock levels are fine.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(lowStock as CatalogProduct[]).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {qtyWithUnit(p.stock, p.unit)} left · reorder at {p.reorder_level}
                    </p>
                  </div>
                  <StockBadge status={p.stock_status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Recent sales" action={<Link href="/sales/invoices" className="text-xs text-amber-600 hover:underline">View all →</Link>}>
          <Table head={["Invoice", "Customer", "Total", "Status"]} colWidths={["18%", "37%", "25%", "20%"]}>
            {(sales as SaleViewRow[] | null)?.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.id}</Td>
                <Td>
                  <Truncate>{r.party_name}</Truncate>
                </Td>
                <Td className="tabular-nums">{formatPKR(r.total)}</Td>
                <Td>
                  <PaymentStatusBadge status={r.payment_status} />
                </Td>
              </tr>
            ))}
          </Table>
          {(sales ?? []).length === 0 && <EmptyRow>No sales yet.</EmptyRow>}
        </Card>

        <Card title="Recent quotations" action={<Link href="/quotations" className="text-xs text-amber-600 hover:underline">View all →</Link>}>
          <Table head={["Quotation", "Customer", "Total", "Status"]} colWidths={["18%", "37%", "25%", "20%"]}>
            {(quotes as QuotationViewRow[] | null)?.map((q) => (
              <tr key={q.id}>
                <Td className="font-medium text-slate-900">{q.quote_no}</Td>
                <Td>
                  <Truncate>{q.customer_name}</Truncate>
                </Td>
                <Td className="tabular-nums">{formatPKR(q.total)}</Td>
                <Td>
                  <QuotationStatusBadge status={q.status} />
                </Td>
              </tr>
            ))}
          </Table>
          {(quotes ?? []).length === 0 && <EmptyRow>No quotations yet.</EmptyRow>}
        </Card>
      </div>
    </>
  );
}
