"use client";

import { useState } from "react";
import { AlertTriangle, DatabaseBackup, Download, Upload } from "lucide-react";
import { Card, PageHeader, Table, Td } from "@/components/ui";
import * as data from "@/lib/demo-data";

const backupTables = {
  products: data.products,
  categories: data.categories,
  stockMovements: data.stockMovements,
  customers: data.customers,
  suppliers: data.suppliers,
  salesInvoices: data.salesInvoices,
  purchaseInvoices: data.purchaseInvoices,
  quotations: data.quotations,
  payments: data.payments,
  expenses: data.expenses,
  services: data.services,
};

export default function BackupPage() {
  const [restore, setRestore] = useState<{ name: string; counts: [string, number][] } | { error: string } | null>(null);

  const downloadBackup = () => {
    const payload = { app: "SolarSales AI", createdAt: new Date().toISOString(), tables: backupTables };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!json.tables || typeof json.tables !== "object") throw new Error();
      setRestore({
        name: file.name,
        counts: Object.entries(json.tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
      });
    } catch {
      setRestore({ error: "This is not a valid backup file." });
    }
  };

  return (
    <>
      <PageHeader demo title="Backup & Restore" description="Download a backup of all data, or restore from an earlier backup." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Backup">
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">All products, customers, invoices, payments and stock history in one JSON file.</p>
            <ul className="grid grid-cols-2 gap-1 text-xs text-slate-500">
              {Object.entries(backupTables).map(([k, v]) => (
                <li key={k}>
                  {k}: <span className="tabular-nums">{v.length}</span>
                </li>
              ))}
            </ul>
            <button onClick={downloadBackup} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600">
              <Download size={16} /> Download backup
            </button>
            <p className="text-xs text-slate-500">In production there is also an automatic nightly database backup.</p>
          </div>
        </Card>

        <Card title="Restore">
          <div className="space-y-4 p-5">
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Restoring replaces the current data. Take a fresh backup first.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
              <Upload size={16} /> Choose backup file
              <input type="file" accept=".json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {restore && "error" in restore && <p className="text-sm text-red-600">{restore.error}</p>}
            {restore && "counts" in restore && (
              <>
                <p className="flex items-center gap-2 text-sm text-slate-700">
                  <DatabaseBackup size={16} /> {restore.name}
                </p>
                <Table head={["Table", "Records"]}>
                  {restore.counts.map(([k, n]) => (
                    <tr key={k}>
                      <Td>{k}</Td>
                      <Td className="tabular-nums">{n}</Td>
                    </tr>
                  ))}
                </Table>
                <button disabled className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white opacity-50" title="Available once this page is connected">
                  Restore (coming soon)
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
