"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, EmptyRow, Table, Td, Truncate } from "@/components/ui";
import { QuotationStatusBadge } from "@/components/status-badges";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { BillActions } from "@/components/bill-actions";
import { formatDate, formatPKR } from "@/lib/format";
import type { QuotationStatus, QuotationViewRow } from "@/lib/types";

export function QuotationsTable({ quotes, canApprove }: { quotes: QuotationViewRow[]; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const run = async (id: number, fn: () => Promise<{ error: { message?: string; code?: string } | null }>) => {
    setBusy(id);
    setError("");
    const { error } = await fn();
    setBusy(null);
    if (error) setError(errorMessage(error));
    router.refresh();
  };

  const decide = (id: number, approve: boolean) => run(id, async () => createClient().rpc("decide_quotation", { p_quotation_id: id, p_approve: approve }));
  const setStatus = (id: number, status: QuotationStatus) =>
    run(id, async () => createClient().rpc("set_quotation_status", { p_quotation_id: id, p_status: status }));

  const link = "text-sm font-medium hover:underline disabled:opacity-50";

  return (
    <>
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <Card>
        <Table
          head={["Quotation", "Customer", "Date", "Valid until", "Items", "Total", "Created by", "Status", "Actions"]}
          // 8 barabar columns + actions ko thodi zyada jagah
          colWidths={["10%", "10%", "10%", "10%", "10%", "10%", "10%", "10%", "20%"]}
          minWidth="1100px"
        >
          {quotes.map((q) => (
            <tr key={q.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">{q.quote_no}</Td>
              <Td>
                <Truncate>{q.customer_name}</Truncate>
              </Td>
              <Td>{formatDate(q.quote_date)}</Td>
              <Td>{formatDate(q.valid_until)}</Td>
              <Td className="tabular-nums">{q.item_count}</Td>
              <Td className="tabular-nums font-medium text-slate-900">{formatPKR(q.total)}</Td>
              <Td>
                <Truncate>{q.created_by_name ?? "—"}</Truncate>
              </Td>
              <Td>
                <QuotationStatusBadge status={q.status} />
              </Td>
              <Td>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {q.status === "pending_approval" && canApprove && (
                    <>
                      <button disabled={busy === q.id} onClick={() => decide(q.id, true)} className={`${link} text-emerald-700`}>
                        Approve
                      </button>
                      <button disabled={busy === q.id} onClick={() => decide(q.id, false)} className={`${link} text-red-600`}>
                        Reject
                      </button>
                    </>
                  )}
                  {q.status === "pending_approval" && !canApprove && <span className="text-xs text-slate-500">With manager</span>}
                  {q.status === "approved" && (
                    <button disabled={busy === q.id} onClick={() => setStatus(q.id, "sent")} className={`${link} text-violet-700`}>
                      Mark sent
                    </button>
                  )}
                  {(q.status === "approved" || q.status === "sent") && (
                    <>
                      <button disabled={busy === q.id} onClick={() => setStatus(q.id, "accepted")} className={`${link} text-emerald-700`}>
                        Accepted
                      </button>
                      <button disabled={busy === q.id} onClick={() => setStatus(q.id, "rejected")} className={`${link} text-slate-500`}>
                        Lost
                      </button>
                    </>
                  )}
                  {q.status !== "pending_approval" && q.status !== "rejected" && (
                    <BillActions kind="quotation" id={q.id} />
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        {quotes.length === 0 && <EmptyRow>No quotations yet.</EmptyRow>}
      </Card>
    </>
  );
}
