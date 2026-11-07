"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Users } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyRow, Field, fieldClass, Modal, StatCard, Table, Td } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { formatDate, formatPKR } from "@/lib/format";
import { PAYMENT_MODES, type InvoiceRow, type PaymentMode } from "@/lib/types";

// Receivables (sales) ya payables (purchases): har khuli invoice, overdue din, aur payment entry.
export function OpenBalances({
  rows,
  direction,
  today,
  hideStats,
}: {
  rows: InvoiceRow[];
  direction: "received" | "paid";
  today: string;
  hideStats?: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [message, setMessage] = useState("");

  const open = rows.filter((r) => r.pending > 0);
  const overdueDays = (r: InvoiceRow) => Math.floor((new Date(today).getTime() - new Date(r.dueDate).getTime()) / 86_400_000);
  const total = open.reduce((s, r) => s + r.pending, 0);
  const overdueTotal = open.filter((r) => overdueDays(r) > 0).reduce((s, r) => s + r.pending, 0);
  const parties = new Set(open.map((r) => r.party)).size;
  const partyLabel = direction === "received" ? "Customer" : "Supplier";

  return (
    <>
      {message && (
        <div className="mb-4">
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      {!hideStats && (
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={direction === "received" ? "Total receivable" : "Total payable"} value={formatPKR(total)} hint={`${open.length} open invoices`} icon={Clock} tone="amber" />
        <StatCard label="Overdue" value={formatPKR(overdueTotal)} hint="Past the payment days" icon={Clock} tone="red" />
        <StatCard label={`${partyLabel}s`} value={String(parties)} icon={Users} tone="blue" />
      </div>
      )}
      <Card>
        <Table head={["Invoice", "Date", partyLabel, "Total", direction === "received" ? "Received" : "Paid", "Pending", "Due date", "Status", ""]}>
          {open
            .sort((a, b) => overdueDays(b) - overdueDays(a))
            .map((r) => {
              const od = overdueDays(r);
              return (
                <tr key={r.no} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{r.no}</Td>
                  <Td>{formatDate(r.date)}</Td>
                  <Td>{r.party}</Td>
                  <Td className="tabular-nums">{formatPKR(r.total)}</Td>
                  <Td className="tabular-nums">{formatPKR(r.received)}</Td>
                  <Td className="font-medium tabular-nums text-red-600">{formatPKR(r.pending)}</Td>
                  <Td>{formatDate(r.dueDate)}</Td>
                  <Td>{od > 0 ? <Badge tone="red">{od} days overdue</Badge> : <Badge tone="green">Within terms</Badge>}</Td>
                  <Td>
                    <button onClick={() => setPaying(r)} className="text-sm font-medium text-amber-600 hover:underline">
                      {direction === "received" ? "Receive payment" : "Make payment"}
                    </button>
                  </Td>
                </tr>
              );
            })}
        </Table>
        {open.length === 0 && <EmptyRow>No pending balances.</EmptyRow>}
      </Card>

      {paying && (
        <PaymentModal
          row={paying}
          direction={direction}
          onClose={() => setPaying(null)}
          onSaved={(text) => {
            setPaying(null);
            setMessage(text);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

export function PaymentModal({ row, direction, onClose, onSaved }: { row: InvoiceRow; direction: "received" | "paid"; onClose: () => void; onSaved: (m: string) => void }) {
  const [amount, setAmount] = useState(String(row.pending));
  const [mode, setMode] = useState<PaymentMode>("Cash");
  const [reference, setReference] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await createClient().rpc("record_payment", {
      p_direction: direction,
      p_document_id: row.no,
      p_amount: Number(amount),
      p_mode: mode,
      p_reference: reference,
      p_payment_date: date,
    });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    onSaved(`${formatPKR(Number(amount))} ${direction === "received" ? "received" : "paid"} (invoice #${row.no}).`);
  };

  return (
    <Modal title={`${direction === "received" ? "Receive payment" : "Make payment"}: #${row.no}`} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <p className="text-sm text-slate-600 sm:col-span-2">
          {row.party} · Pending <span className="font-semibold text-red-600">{formatPKR(row.pending)}</span>
        </p>
        <Field label="Amount (Rs)">
          <input required type="number" min={1} max={row.pending} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={fieldClass}>
            {PAYMENT_MODES.filter((m) => m !== "Due").map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment date">
          <input required type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Reference (cheque / transaction no.)">
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={fieldClass} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
