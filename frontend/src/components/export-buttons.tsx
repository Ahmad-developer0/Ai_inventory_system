"use client";

import { FileJson, FileSpreadsheet, FileText } from "lucide-react";

type Row = Record<string, string | number | boolean>;

// Excel formula injection se bachao: "=", "+", "-", "@" se shuru hone wala text formula na bane
function safeCell(v: unknown) {
  return typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function safeRows(rows: Row[]): Row[] {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v) as Row[string]])));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function ExportButtons({ rows, filename }: { rows: Row[]; filename: string }) {
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeRows(rows)), "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const items = [
    { label: "Excel", icon: FileSpreadsheet, onClick: exportExcel },
    { label: "CSV", icon: FileText, onClick: () => download(new Blob([toCSV(safeRows(rows))], { type: "text/csv" }), `${filename}.csv`) },
    {
      label: "JSON",
      icon: FileJson,
      onClick: () => download(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }), `${filename}.json`),
    },
  ];

  return (
    <div className="flex gap-2">
      {items.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Icon size={16} className="text-teal-700" />
          {label}
        </button>
      ))}
    </div>
  );
}
