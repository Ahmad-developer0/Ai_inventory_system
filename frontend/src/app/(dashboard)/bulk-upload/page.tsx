"use client";

import { useState } from "react";
import { CheckCircle2, Download, Upload, XCircle } from "lucide-react";
import { Card, PageHeader, Table, Td } from "@/components/ui";

const templates = {
  products: ["sku", "name", "brand", "category", "rating", "purchasePrice", "sellingPrice", "minPrice", "stock", "reorderLevel"],
  customers: ["name", "phone", "city", "type"],
  suppliers: ["name", "phone", "city", "products"],
} as const;

type Kind = keyof typeof templates;

const numeric = new Set(["purchasePrice", "sellingPrice", "minPrice", "stock", "reorderLevel"]);

// Simple CSV parser: quoted values aur commas ko handle karta hai.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function validate(kind: Kind, headers: string[], row: string[]): string | null {
  const required = templates[kind];
  for (const col of required) {
    const v = row[headers.indexOf(col)];
    if (v === undefined || v === "") return `${col} is empty`;
    if (numeric.has(col) && isNaN(Number(v))) return `${col} is not a number`;
  }
  if (kind === "products") {
    const get = (c: string) => Number(row[headers.indexOf(c)]);
    if (get("minPrice") > get("sellingPrice")) return "minPrice is higher than sellingPrice";
  }
  return null;
}

export default function BulkUploadPage() {
  const [kind, setKind] = useState<Kind>("products");
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; missing: string[] } | null>(null);
  const [imported, setImported] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([templates[kind].join(",") + "\n"], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}-template.csv`;
    a.click();
  };

  const onFile = async (file: File | undefined) => {
    setImported(false);
    if (!file) return setParsed(null);
    const [headers = [], ...rows] = parseCSV(await file.text());
    setParsed({ headers, rows, missing: templates[kind].filter((c) => !headers.includes(c)) });
  };

  const results = parsed && parsed.missing.length === 0 ? parsed.rows.map((r) => validate(kind, parsed.headers, r)) : [];
  const validCount = results.filter((r) => r === null).length;

  return (
    <>
      <PageHeader demo title="Bulk Uploads" description="Export a CSV from your old software and import products, customers or suppliers in one go." />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">What are you uploading?</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setParsed(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="products">Products</option>
              <option value="customers">Customers</option>
              <option value="suppliers">Suppliers</option>
            </select>
          </label>
          <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            <Download size={16} /> Template CSV
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400">
            <Upload size={16} /> Choose CSV
            <input key={kind} type="file" accept=".csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Required columns: {templates[kind].join(", ")}</p>
      </Card>

      {parsed && parsed.missing.length > 0 && (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm text-red-600">
            <XCircle size={16} /> Missing columns: {parsed.missing.join(", ")}. Use the template CSV.
          </p>
        </Card>
      )}

      {parsed && parsed.missing.length === 0 && (
        <Card
          title={`Preview: ${validCount} valid, ${parsed.rows.length - validCount} with errors`}
          action={
            <button
              disabled={validCount === 0}
              onClick={() => setImported(true)}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
            >
              Import {validCount} rows
            </button>
          }
        >
          {imported && (
            <p className="flex items-center gap-2 border-b border-slate-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
              <CheckCircle2 size={16} /> {validCount} rows imported (demo). They will go to the database once this page is connected.
            </p>
          )}
          <Table head={["#", ...parsed.headers, "Check"]}>
            {parsed.rows.map((r, i) => (
              <tr key={i} className={results[i] ? "bg-red-50/50" : ""}>
                <Td className="text-slate-400">{i + 1}</Td>
                {parsed.headers.map((_, j) => (
                  <Td key={j}>{r[j]}</Td>
                ))}
                <Td>{results[i] ? <span className="text-xs text-red-600">{results[i]}</span> : <CheckCircle2 size={16} className="text-emerald-600" />}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
