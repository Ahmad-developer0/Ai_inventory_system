"use client";

import { createClient } from "@/lib/supabase/client";
import { BUSINESS } from "@/lib/business";
import { num } from "@/lib/types";
import { qtyWithUnit } from "@/lib/units";

interface PdfLine {
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
}

interface PdfDoc {
  title: "QUOTATION" | "SALES INVOICE";
  number: string;
  date: string;
  extra: [string, string][]; // e.g. ["Valid until", "06 Nov 2026"]
  party: string;
  partyPhone?: string | null;
  lines: PdfLine[];
  subtotal: number;
  tax: number;
  less?: number;
  total: number;
  received?: number;
  notes?: string | null;
}

const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-PK");

export type PdfAction = "download" | "print" | "share";

async function renderPdf(doc: PdfDoc, action: PdfAction) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const M = 40;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 80, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold").setFontSize(18).text(BUSINESS.name, M, 36);
  pdf.setFont("helvetica", "normal").setFontSize(9).text(BUSINESS.tagline, M, 52);
  pdf.text(`${BUSINESS.address} · ${BUSINESS.phone}`, M, 65);
  pdf.setFont("helvetica", "bold").setFontSize(16).text(doc.title, W - M, 44, { align: "right" });

  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold").setFontSize(10).text("Bill to", M, 110);
  pdf.setFont("helvetica", "normal").text(doc.party, M, 125);
  if (doc.partyPhone) pdf.text(doc.partyPhone, M, 139);

  const meta: [string, string][] = [["No.", doc.number], ["Date", doc.date], ...doc.extra];
  meta.forEach(([k, v], i) => {
    pdf.setFont("helvetica", "bold").text(k, W - M - 160, 110 + i * 14);
    pdf.setFont("helvetica", "normal").text(v, W - M, 110 + i * 14, { align: "right" });
  });

  autoTable(pdf, {
    startY: 165,
    margin: { left: M, right: M },
    head: [["#", "Item", "Qty", "Rate", "Disc %", "Amount"]],
    body: doc.lines.map((l, i) => [
      String(i + 1),
      `${l.name}\n${l.sku}`,
      qtyWithUnit(l.qty, l.unit),
      rs(l.unitPrice),
      l.discountPct ? `${l.discountPct}%` : "—",
      rs(l.lineTotal),
    ]),
    headStyles: { fillColor: [245, 158, 11], textColor: [15, 23, 42] },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: { 0: { cellWidth: 24 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (pdf as any).lastAutoTable.finalY + 20;
  const totals: [string, string][] = [
    ["Subtotal", rs(doc.subtotal)],
    ...(doc.tax ? ([["Sales tax", rs(doc.tax)]] as [string, string][]) : []),
    ...(doc.less ? ([["Less", `- ${rs(doc.less)}`]] as [string, string][]) : []),
    ["Grand total", rs(doc.total)],
    ...(doc.received !== undefined
      ? ([
          ["Received", rs(doc.received)],
          ["Balance due", rs(doc.total - doc.received)],
        ] as [string, string][])
      : []),
  ];
  totals.forEach(([k, v]) => {
    const bold = k === "Grand total" || k === "Balance due";
    pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 10);
    pdf.text(k, W - M - 160, y);
    pdf.text(v, W - M, y, { align: "right" });
    y += 16;
  });

  if (doc.notes) {
    y += 10;
    pdf.setFont("helvetica", "bold").setFontSize(10).text("Notes", M, y);
    pdf.setFont("helvetica", "normal").setFontSize(9).text(pdf.splitTextToSize(doc.notes, W - 2 * M), M, y + 14);
  }

  pdf.setFontSize(8).setTextColor(100, 116, 139);
  pdf.text("Computer generated document. Prices subject to stock availability.", W / 2, pdf.internal.pageSize.getHeight() - 24, { align: "center" });
  await deliver(pdf, `${doc.number}.pdf`, `${doc.title} ${doc.number}`, action);
}

// Download, print (naye tab mein print dialog), ya share (mobile/WhatsApp; na ho sake to download)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deliver(pdf: any, filename: string, title: string, action: PdfAction) {
  if (action === "print") {
    pdf.autoPrint();
    const win = window.open(pdf.output("bloburl"), "_blank");
    if (!win) pdf.save(filename); // popup block ho to download
    return;
  }
  if (action === "share") {
    const file = new File([pdf.output("blob")], filename, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
      } catch {
        // user ne share cancel kiya
      }
      return;
    }
  }
  pdf.save(filename);
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

async function loadLines(table: "quotation_items" | "sale_items", fk: string, id: number): Promise<PdfLine[]> {
  const supabase = createClient();
  const { data: items, error } = await supabase.from(table).select("product_id, qty, unit_price, discount_pct, line_total").eq(fk, id).order("id");
  if (error) throw new Error(error.message);
  const ids = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: products } = await supabase.from("product_catalog").select("id, name, sku, unit").in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  return (items ?? []).map((i) => ({
    name: byId.get(i.product_id)?.name ?? `Product #${i.product_id}`,
    sku: byId.get(i.product_id)?.sku ?? "",
    qty: i.qty,
    unit: byId.get(i.product_id)?.unit ?? "pcs",
    unitPrice: num(i.unit_price),
    discountPct: num(i.discount_pct),
    lineTotal: num(i.line_total),
  }));
}

export async function quotationPdf(quotationId: number, action: PdfAction = "download") {
  const supabase = createClient();
  const { data: q, error } = await supabase.from("quotations_view").select("*").eq("id", quotationId).single();
  if (error || !q) throw new Error(error?.message ?? "Quotation not found");
  await renderPdf({
    title: "QUOTATION",
    number: q.quote_no,
    date: fmtDate(q.quote_date),
    extra: [["Valid until", fmtDate(q.valid_until)]],
    party: q.customer_name,
    partyPhone: q.customer_phone,
    lines: await loadLines("quotation_items", "quotation_id", quotationId),
    subtotal: num(q.subtotal),
    tax: num(q.tax),
    total: num(q.total),
    notes: q.notes,
  }, action);
}

export async function salePdf(saleId: number, action: PdfAction = "download") {
  const supabase = createClient();
  const { data: s, error } = await supabase.from("sales_view").select("*").eq("id", saleId).single();
  if (error || !s) throw new Error(error?.message ?? "Invoice not found");
  await renderPdf({
    title: "SALES INVOICE",
    number: `INV-${s.id}`,
    date: fmtDate(s.sale_date),
    extra: [
      ["Payment", s.payment_mode],
      ...(s.payment_days ? ([["Due date", fmtDate(s.due_date)]] as [string, string][]) : []),
    ],
    party: s.party_name,
    partyPhone: s.party_phone,
    lines: await loadLines("sale_items", "sale_id", saleId),
    subtotal: num(s.subtotal),
    tax: num(s.tax),
    less: num(s.less_amount),
    total: num(s.total),
    received: num(s.amount_received),
  }, action);
}
