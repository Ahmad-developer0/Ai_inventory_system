"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock, Receipt, Search } from "lucide-react";
import { Alert, Card, EmptyRow, fieldClass, StatCard, Table, Td } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { PaymentStatusBadge } from "@/components/status-badges";
import { BillActions } from "@/components/bill-actions";
import { PaymentModal } from "@/components/open-balances";
import { formatDate, formatPKR } from "@/lib/format";
import type { InvoiceRow, PaymentStatus } from "@/lib/types";

// Sales aur purchase invoices dono ke liye same list.
export function InvoiceTable({ rows, kind, filename, hideStats }: { rows: InvoiceRow[]; kind: "sale" | "purchase"; filename: string; hideStats?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const router = useRouter();
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [paidMessage, setPaidMessage] = useState("");
  const partyLabel = kind === "sale" ? "Customer" : "Supplier";
  const receivedLabel = kind === "sale" ? "Amount received" : "Amount paid";

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter((r) => (status === "all" || r.status === status) && (String(r.no).includes(q) || r.party.toLowerCase().includes(q)));
  }, [rows, query, status]);

  const total = filtered.reduce((s, r) => s + r.total, 0);
  const received = filtered.reduce((s, r) => s + r.received, 0);

  const exportRows = filtered.map((r) => ({
    Date: r.date,
    "Invoice No": r.no,
    [partyLabel]: r.party,
    "Mode of Payment": r.mode,
    "Total Items": r.items,
    Total: r.total,
    [receivedLabel]: r.received,
    "Payment Days": r.paymentDays,
    "Pending Amount": r.pending,
    Status: r.status,
  }));


  return (
    <>
      {!hideStats && (
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={formatPKR(total)} hint={`${filtered.length} invoices`} icon={Receipt} tone="blue" />
        <StatCard label={receivedLabel} value={formatPKR(received)} icon={Banknote} tone="green" />
        <StatCard label="Pending amount" value={formatPKR(total - received)} icon={Clock} tone="red" />
      </div>
      )}

      {paidMessage && (
        <div className="mb-4">
          <Alert tone="success">{paidMessage}</Alert>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search invoice number or ${partyLabel.toLowerCase()} name…`}
              className={`${fieldClass} pl-9`}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "all")} className={`${fieldClass} lg:w-40`}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <ExportButtons rows={exportRows} filename={filename} />
        </div>

        <Table head={["Date", "Invoice No", partyLabel, "Mode of payment", "Items", "Total", receivedLabel, "Payment days", "Pending", "Status", ...(kind === "sale" ? [""] : [])]}>
          {filtered.map((r) => (
            <tr key={r.no} className="hover:bg-slate-50">
              <Td>{formatDate(r.date)}</Td>
              <Td className="font-medium text-slate-900">{r.no}</Td>
              <Td>{r.party}</Td>
              <Td>{r.mode}</Td>
              <Td className="tabular-nums">{r.items}</Td>
              <Td className="tabular-nums font-medium text-slate-900">{formatPKR(r.total)}</Td>
              <Td className="tabular-nums">{formatPKR(r.received)}</Td>
              <Td className="tabular-nums">{r.paymentDays}</Td>
              <Td className={`tabular-nums ${r.pending > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{formatPKR(r.pending)}</Td>
              <Td>
                <PaymentStatusBadge status={r.status} />
              </Td>
              {kind === "sale" && (
                <Td>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {r.pending > 0 && (
                      <button onClick={() => setPaying(r)} className="text-xs font-medium text-amber-600 hover:underline">
                        Receive payment
                      </button>
                    )}
                    <BillActions kind="sale" id={r.no} />
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <EmptyRow>{rows.length === 0 ? "No invoices yet." : "No invoices found."}</EmptyRow>}
      </Card>

      {paying && (
        <PaymentModal
          row={paying}
          direction="received"
          onClose={() => setPaying(null)}
          onSaved={(text) => {
            setPaying(null);
            setPaidMessage(text);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
