import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, Clock, FileText, Package, Plus, Receipt } from "lucide-react";
import { Alert, Badge, Card, EmptyRow, LinkButton, PageHeader, StatCard, Table, Td, Truncate } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { InvoiceTable } from "@/components/invoice-table";
import { OpenBalances } from "@/components/open-balances";
import { QuotationStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import { saleToRow } from "@/lib/data";
import { formatDate, formatPKR } from "@/lib/format";
import { qtyWithUnit } from "@/lib/units";
import { num, type Customer, type PaymentViewRow, type QuotationViewRow, type SaleViewRow } from "@/lib/types";

// Aik customer ka poora record: kya saman gaya, kaunse bill pending hain, kya pay hua, aur ledger.
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();

  const supabase = await createClient();
  const [{ data: customer }, { data: salesData, error }, { data: quotesData }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
    supabase.from("sales_view").select("*").eq("customer_id", customerId).order("sale_date").order("id"),
    supabase.from("quotations_view").select("*").eq("customer_id", customerId).order("id", { ascending: false }),
  ]);
  if (!customer) notFound();
  const c = customer as Customer;
  const sales = (salesData ?? []) as SaleViewRow[];
  const quotes = (quotesData ?? []) as QuotationViewRow[];
  const saleIds = sales.map((s) => s.id);

  const [{ data: itemsData }, { data: paymentsData }] = saleIds.length
    ? await Promise.all([
        supabase.from("sale_items").select("sale_id, product_id, qty, line_total").in("sale_id", saleIds),
        supabase.from("payments_view").select("*").in("sale_id", saleIds).order("payment_date").order("id"),
      ])
    : [{ data: [] }, { data: [] }];
  const items = (itemsData ?? []) as { sale_id: number; product_id: number; qty: number; line_total: number }[];
  const payments = (paymentsData ?? []) as PaymentViewRow[];

  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: productsData } = productIds.length
    ? await supabase.from("product_catalog").select("id, name, sku, unit").in("id", productIds)
    : { data: [] };
  const productById = new Map((productsData ?? []).map((p: { id: number; name: string; sku: string; unit: string }) => [p.id, p]));
  const saleDate = new Map(sales.map((s) => [s.id, s.sale_date]));

  // Kya saman gaya: product ke hisaab se jama
  const goods = new Map<number, { name: string; sku: string; unit: string; qty: number; amount: number; invoices: Set<number>; last: string }>();
  for (const i of items) {
    const p = productById.get(i.product_id);
    const g = goods.get(i.product_id) ?? { name: p?.name ?? `Product #${i.product_id}`, sku: p?.sku ?? "", unit: p?.unit ?? "pcs", qty: 0, amount: 0, invoices: new Set(), last: "" };
    g.qty += i.qty;
    g.amount += num(i.line_total);
    g.invoices.add(i.sale_id);
    const d = saleDate.get(i.sale_id) ?? "";
    if (d > g.last) g.last = d;
    goods.set(i.product_id, g);
  }
  const goodsRows = [...goods.values()].sort((a, b) => b.amount - a.amount);

  // Ledger: sale = debit (balance barhta hai), payment = credit (balance kam)
  type Entry = { date: string; order: number; label: string; ref: string; debit: number; credit: number };
  const entries: Entry[] = [
    ...sales.map((s) => ({ date: s.sale_date, order: 0, label: "Sale invoice", ref: `INV-${s.id}`, debit: num(s.total), credit: 0 })),
    ...payments.map((p) => ({ date: p.payment_date, order: 1, label: `Payment (${p.mode})`, ref: p.reference ?? `INV-${p.sale_id}`, debit: 0, credit: num(p.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  let balance = 0;
  const ledger = entries.map((e) => ({ ...e, balance: (balance += e.debit - e.credit) }));

  const totalPurchases = sales.reduce((s, r) => s + num(r.total), 0);
  const totalPaid = sales.reduce((s, r) => s + num(r.amount_received), 0);
  const pending = totalPurchases - totalPaid;
  const lastSale = sales.at(-1)?.sale_date;
  const invoiceRows = [...sales].reverse().map(saleToRow);

  return (
    <>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Customers
      </Link>
      <PageHeader
        title={c.name}
        description={[c.phone, c.city, c.type, c.opt_out ? "Marketing opt-out" : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <LinkButton href="/sales/new" variant="teal" icon={Plus}>
              New sale
            </LinkButton>
            <LinkButton href="/quotations/new" variant="secondary" icon={FileText}>
              New quotation
            </LinkButton>
          </>
        }
      />
      {c.notes && (
        <div className="mb-4">
          <Alert tone="info">{c.notes}</Alert>
        </div>
      )}
      {error && <Alert tone="error">{error.message}</Alert>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total purchases" value={formatPKR(totalPurchases)} hint={`${sales.length} invoices`} icon={Receipt} tone="blue" />
        <StatCard label="Paid" value={formatPKR(totalPaid)} icon={Banknote} tone="green" />
        <StatCard label="Pending" value={formatPKR(pending)} hint={pending > 0 ? `${invoiceRows.filter((r) => r.pending > 0).length} bills unpaid` : "All clear"} icon={Clock} tone={pending > 0 ? "red" : "green"} />
        <StatCard label="Last purchase" value={lastSale ? formatDate(lastSale) : "—"} hint={`${goodsRows.length} different products`} icon={Package} tone="amber" />
      </div>

      {pending > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Pending bills</h2>
          <OpenBalances rows={invoiceRows} direction="received" today={new Date().toISOString().slice(0, 10)} hideStats />
        </section>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card title="Goods supplied">
          <Table head={["Product", "Qty", "Amount", "Invoices", "Last time"]} colWidths={["40%", "12%", "20%", "12%", "16%"]}>
            {goodsRows.map((g) => (
              <tr key={g.sku + g.name}>
                <Td>
                  <Truncate>{g.name}</Truncate>
                  <p className="font-mono text-xs text-slate-500">{g.sku}</p>
                </Td>
                <Td className="font-medium tabular-nums">{qtyWithUnit(g.qty, g.unit)}</Td>
                <Td className="tabular-nums">{formatPKR(g.amount)}</Td>
                <Td className="tabular-nums">{g.invoices.size}</Td>
                <Td>{formatDate(g.last)}</Td>
              </tr>
            ))}
          </Table>
          {goodsRows.length === 0 && <EmptyRow>No goods supplied to this customer yet.</EmptyRow>}
        </Card>

        <Card
          title="Ledger statement"
          action={
            <ExportButtons
              filename={`ledger-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
              rows={ledger.map((e) => ({ Date: e.date, Detail: e.label, Reference: e.ref, Debit: e.debit, Credit: e.credit, Balance: e.balance }))}
            />
          }
        >
          <Table head={["Date", "Detail", "Debit", "Credit", "Balance"]} colWidths={["18%", "30%", "18%", "17%", "17%"]}>
            {ledger.map((e, i) => (
              <tr key={i}>
                <Td>{formatDate(e.date)}</Td>
                <Td>
                  <Truncate>{e.label}</Truncate>
                  <p className="truncate font-mono text-xs text-slate-500" title={e.ref}>
                    {e.ref}
                  </p>
                </Td>
                <Td className="tabular-nums">{e.debit ? formatPKR(e.debit) : ""}</Td>
                <Td className="tabular-nums text-emerald-700">{e.credit ? formatPKR(e.credit) : ""}</Td>
                <Td className={`font-medium tabular-nums ${e.balance > 0 ? "text-red-600" : "text-slate-900"}`}>{formatPKR(e.balance)}</Td>
              </tr>
            ))}
          </Table>
          {ledger.length === 0 && <EmptyRow>No entries yet.</EmptyRow>}
        </Card>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">All invoices</h2>
        <InvoiceTable rows={invoiceRows} kind="sale" filename={`invoices-${customerId}`} hideStats />
      </section>

      <Card title="Quotations">
        <Table head={["Quotation", "Date", "Valid until", "Total", "Status"]}>
          {quotes.map((q) => (
            <tr key={q.id}>
              <Td className="font-medium text-slate-900">{q.quote_no}</Td>
              <Td>{formatDate(q.quote_date)}</Td>
              <Td>{formatDate(q.valid_until)}</Td>
              <Td className="tabular-nums">{formatPKR(q.total)}</Td>
              <Td>
                <QuotationStatusBadge status={q.status} />
              </Td>
            </tr>
          ))}
        </Table>
        {quotes.length === 0 && <EmptyRow>No quotations.</EmptyRow>}
        {quotes.length > 0 && (
          <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
            Open the <Link href="/quotations" className="text-amber-600 hover:underline">Quotations page</Link> to approve, print or change status. <Badge>{quotes.length}</Badge>
          </p>
        )}
      </Card>
    </>
  );
}
