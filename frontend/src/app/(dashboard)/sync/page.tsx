"use client";

import { useState } from "react";
import { CheckCircle2, Cloud, Laptop, RefreshCw } from "lucide-react";
import { Card, PageHeader, Table, Td } from "@/components/ui";

const initialPending = [
  { table: "Sales invoices", count: 3 },
  { table: "Stock movements", count: 7 },
  { table: "Customers", count: 1 },
  { table: "Payments", count: 2 },
];

export default function SyncPage() {
  const [pending, setPending] = useState(initialPending);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("2026-10-30 10:42");

  const sync = () => {
    setSyncing(true);
    // Demo: asal sync Step 12 (deployment) ke baad cloud server se hoga
    setTimeout(() => {
      setPending((p) => p.map((r) => ({ ...r, count: 0 })));
      setLastSync(new Date().toLocaleString("en-PK"));
      setSyncing(false);
    }, 1500);
  };

  const total = pending.reduce((s, r) => s + r.count, 0);

  return (
    <>
      <PageHeader demo title="Sync Data" description="Sync this computer with the cloud server. Keep working offline and sync later." />

      <Card className="mb-6 p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <Laptop size={32} className="text-slate-500" />
            <RefreshCw size={20} className={`text-amber-500 ${syncing ? "animate-spin" : ""}`} />
            <Cloud size={32} className="text-teal-600" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm text-slate-500">Last synced</p>
            <p className="font-medium text-slate-900">{lastSync}</p>
          </div>
          <button
            onClick={sync}
            disabled={syncing || total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : total === 0 ? "Up to date" : `Sync ${total} changes`}
          </button>
        </div>
      </Card>

      <Card title="Pending changes">
        <Table head={["Data", "Unsynced records"]}>
          {pending.map((r) => (
            <tr key={r.table}>
              <Td className="font-medium text-slate-900">{r.table}</Td>
              <Td>
                {r.count === 0 ? (
                  <span className="flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 size={14} /> Synced
                  </span>
                ) : (
                  <span className="tabular-nums text-amber-700">{r.count}</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
