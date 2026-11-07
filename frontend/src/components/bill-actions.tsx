"use client";

import { useState } from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { quotationPdf, salePdf, type PdfAction } from "@/lib/pdf";

// Bill / quotation: PDF download, print, aur share (WhatsApp waghera)
export function BillActions({ kind, id, size = "sm" }: { kind: "sale" | "quotation"; id: number; size?: "sm" | "lg" }) {
  const [busy, setBusy] = useState<PdfAction | null>(null);
  const [error, setError] = useState("");

  const run = async (action: PdfAction) => {
    setBusy(action);
    setError("");
    try {
      await (kind === "sale" ? salePdf(id, action) : quotationPdf(id, action));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const buttons: { action: PdfAction; label: string; icon: typeof Download }[] = [
    { action: "download", label: "PDF", icon: Download },
    { action: "print", label: "Print", icon: Printer },
    { action: "share", label: "Share", icon: Share2 },
  ];

  const cls =
    size === "lg"
      ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      : "inline-flex items-center gap-1 text-xs text-teal-700 hover:underline disabled:opacity-50";

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {buttons.map(({ action, label, icon: Icon }) => (
        <button key={action} onClick={() => run(action)} disabled={busy !== null} className={cls} title={`${label} ${kind === "sale" ? "bill" : "quotation"}`}>
          <Icon size={size === "lg" ? 16 : 14} /> {busy === action ? "…" : label}
        </button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
