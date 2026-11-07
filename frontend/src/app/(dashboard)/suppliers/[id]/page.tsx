import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Clock, Package, Plus, Receipt } from "lucide-react";
import { Card, EmptyRow, LinkButton, PageHeader, StatCard, Table, Td, Truncate } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { InvoiceTable } from "@/components/invoice-table";
import { OpenBalances } from "@/components/open-balances";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { purchaseToRow } from "@/lib/data";
import { formatDate, formatPKR } from "@/lib/format";
import { qtyWithUnit, unitShort } from "@/lib/units";
import { num, type PurchaseViewRow, type Supplier } from "@/lib/types";

// Aik supplier ka record: us se kya liya, kis rate par, kitna dena baqi hai
export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManager();
  const { id } = await params;
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId)) notFound();

  const supabase = await createClient();
  const [{ data: supplierData }, { data: purchasesData }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle(),
    supabase.from("purchases_view").select("*").eq("supplier_id", supplierId).order("purchase_date").order("id"),
  ]);
  if (!supplierData) notFound();
  const supplier = supplierData as Supplier;
  const purchases = (purchasesData ?? []) as PurchaseViewRow[];
  const purchaseIds = purchases.map((p) => p.id);

  const { data: itemsData } = purchaseIds.length
    ? await supabase.from("purchase_items").select("purchase_id, product_id, qty, unit_cost, line_total").in("purchase_id", purchaseIds).order("id")
    : { data: [] };
  const items = (itemsData ?? []) as { purchase_id: number; product_id: number; qty: number; unit_cost: number; line_total: number }[];
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: productsData } = productIds.length
    ? await supabase.from("product_catalog").select("id, name, sku, unit").in("id", productIds)
    : { data: [] };
  const productById = new Map((productsData ?? []).map((p: { id: number; name: string; sku: string; unit: string }) => [p.id, p]));
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));

  // Har item ki line: tareekh, bill, product, qty, rate
  const history = items
    .map((i) => {
      const pur = purchaseById.get(i.purchase_id)!;
      const prod = productById.get(i.product_id);
      return {
        date: pur.purchase_date,
        purchaseId: i.purchase_id,
        billNo: pur.bill_no,
        productId: i.product_id,
        name: prod?.name ?? `Product #${i.product_id}`,
        unit: prod?.unit ?? "pcs",
        qty: i.qty,
        rate: num(i.unit_cost),
        amount: num(i.line_total),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.purchaseId - a.purchaseId);

  // Product ke hisaab se: kul qty, aakhri rate, sab se kam rate
  const byProduct = new Map<number, { name: string; unit: string; qty: number; amount: number; lastRate: number; lowRate: number; last: string }>();
  for (const h of [...history].reverse()) {
    const g = byProduct.get(h.productId) ?? { name: h.name, unit: h.unit, qty: 0, amount: 0, lastRate: h.rate, lowRate: h.rate, last: h.date };
    g.qty += h.qty;
    g.amount += h.amount;
    g.lastRate = h.rate;
    g.lowRate = Math.min(g.lowRate, h.rate);
    g.last = h.date;
    byProduct.set(h.productId, g);
  }
  const products = [...byProduct.entries()].sort((a, b) => b[1].amount - a[1].amount);

  const total = purchases.reduce((s, p) => s + num(p.total), 0);
  const paid = purchases.reduce((s, p) => s + num(p.amount_paid), 0);
  const rows = [...purchases].reverse().map(purchaseToRow);

  return (
    <>
      <Link href="/suppliers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Suppliers
      </Link>
      <PageHeader
        title={supplier.name}
        description={[supplier.contact_name, supplier.phone, supplier.city, supplier.notes].filter(Boolean).join(" · ")}
        actions={
          <LinkButton href="/purchases/new" variant="red" icon={Plus}>
            Add purchase
          </LinkButton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total bought" value={formatPKR(total)} hint={`${purchases.length} bills`} icon={Receipt} tone="blue" />
        <StatCard label="Paid" value={formatPKR(paid)} icon={Banknote} tone="green" />
        <StatCard label="Payable" value={formatPKR(total - paid)} icon={Clock} tone={total - paid > 0 ? "red" : "green"} />
        <StatCard label="Last purchase" value={purchases.length ? formatDate(purchases.at(-1)!.purchase_date) : "—"} hint={`${products.length} products`} icon={Package} tone="amber" />
      </div>

      {total - paid > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Unpaid bills</h2>
          <OpenBalances rows={rows} direction="paid" today={new Date().toISOString().slice(0, 10)} hideStats />
        </section>
      )}

      <Card title="Products bought from this supplier" className="mb-6">
        <Table head={["Product", "Total qty", "Last cost / unit", "Lowest cost / unit", "Total cost", "Last bought"]} colWidths={["32%", "13%", "14%", "14%", "15%", "12%"]}>
          {products.map(([pid, g]) => (
            <tr key={pid} className="hover:bg-slate-50">
              <Td>
                <Link href={`/products/${pid}`} className="text-teal-700 hover:underline">
                  <Truncate>{g.name}</Truncate>
                </Link>
              </Td>
              <Td className="tabular-nums">{qtyWithUnit(g.qty, g.unit)}</Td>
              <Td className="font-medium tabular-nums">
                {formatPKR(g.lastRate)} <span className="text-xs font-normal text-slate-500">/ {unitShort(g.unit)}</span>
              </Td>
              <Td className="tabular-nums">{formatPKR(g.lowRate)}</Td>
              <Td className="tabular-nums">{formatPKR(g.amount)}</Td>
              <Td>{formatDate(g.last)}</Td>
            </tr>
          ))}
        </Table>
        {products.length === 0 && <EmptyRow>Nothing bought from this supplier yet.</EmptyRow>}
      </Card>

      <Card
        title="Purchase history (item by item)"
        className="mb-6"
        action={
          <ExportButtons
            filename={`supplier-${supplier.name.replace(/\s+/g, "-").toLowerCase()}-history`}
            rows={history.map((h) => ({ Date: h.date, Bill: h.billNo ?? `PUR-${h.purchaseId}`, Product: h.name, Qty: h.qty, Unit: unitShort(h.unit), "Cost per unit": h.rate, "Total cost": h.amount }))}
          />
        }
      >
        <Table head={["Date", "Bill", "Product", "Qty", "Cost / unit", "Total cost"]} colWidths={["14%", "14%", "32%", "13%", "14%", "13%"]}>
          {history.map((h, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <Td>{formatDate(h.date)}</Td>
              <Td>
                <Truncate>{h.billNo ?? `PUR-${h.purchaseId}`}</Truncate>
              </Td>
              <Td>
                <Truncate>{h.name}</Truncate>
              </Td>
              <Td className="tabular-nums">{qtyWithUnit(h.qty, h.unit)}</Td>
              <Td className="tabular-nums">{formatPKR(h.rate)}</Td>
              <Td className="tabular-nums">{formatPKR(h.amount)}</Td>
            </tr>
          ))}
        </Table>
        {history.length === 0 && <EmptyRow>No purchases yet.</EmptyRow>}
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">All bills</h2>
        <InvoiceTable rows={rows} kind="purchase" filename={`supplier-${supplierId}-bills`} hideStats />
      </section>
    </>
  );
}
