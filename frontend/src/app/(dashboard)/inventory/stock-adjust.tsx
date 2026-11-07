"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Alert, Button, Field, fieldClass, Modal } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { qtyWithUnit, unitShort } from "@/lib/units";

type Kind = "IN" | "OUT" | "ADJUST";

export function StockAdjustButton({ products }: { products: { id: number; name: string; sku: string; stock: number; unit: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [kind, setKind] = useState<Kind>("IN");
  const [qty, setQty] = useState("");
  const [direction, setDirection] = useState<"+" | "-">("-");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => String(p.id) === productId);
  const n = Math.abs(Number(qty) || 0);
  const signed = kind === "IN" ? n : kind === "OUT" ? -n : direction === "+" ? n : -n;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || n === 0) return setError("Product and quantity are required.");
    if (kind === "ADJUST" && !note.trim()) return setError("Enter a reason for the adjustment (e.g. damaged, count correction).");
    setSaving(true);
    setError("");
    const { error } = await createClient()
      .from("stock_movements")
      .insert({ product_id: product.id, type: kind, qty: signed, reference: reference.trim() || (kind === "ADJUST" ? "Manual adjustment" : `Manual ${kind}`), note: note.trim() || null });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    setOpen(false);
    setQty("");
    setNote("");
    setReference("");
    router.refresh();
  };

  return (
    <>
      <Button icon={SlidersHorizontal} onClick={() => setOpen(true)}>
        Stock IN / OUT / Adjust
      </Button>
      {open && (
        <Modal title="Stock movement" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {error && (
              <div className="sm:col-span-2">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            <p className="text-xs text-slate-500 sm:col-span-2">
              Sales and purchases update stock automatically. Use this form only for manual changes (opening count, damage, returns).
            </p>
            <Field label="Product" className="sm:col-span-2">
              <select required value={productId} onChange={(e) => setProductId(e.target.value)} className={fieldClass}>
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) · stock {qtyWithUnit(p.stock, p.unit)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={fieldClass}>
                <option value="IN">IN (goods received)</option>
                <option value="OUT">OUT (goods issued)</option>
                <option value="ADJUST">ADJUST (count correction)</option>
              </select>
            </Field>
            <Field label={`Quantity${product ? ` (${unitShort(product.unit)})` : ""}`}>
              <div className="flex gap-2">
                {kind === "ADJUST" && (
                  <select value={direction} onChange={(e) => setDirection(e.target.value as "+" | "-")} className={`${fieldClass} w-20`}>
                    <option value="-">−</option>
                    <option value="+">+</option>
                  </select>
                )}
                <input required type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} />
              </div>
            </Field>
            <Field label="Reference">
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={fieldClass} placeholder="Gate pass / bill no." />
            </Field>
            <Field label={kind === "ADJUST" ? "Reason *" : "Note"}>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} placeholder="Damaged, count correction…" />
            </Field>
            {product && n > 0 && (
              <p className="text-sm text-slate-600 sm:col-span-2">
                Stock: {qtyWithUnit(product.stock, product.unit)} → <span className="font-semibold">{qtyWithUnit(product.stock + signed, product.unit)}</span>
              </p>
            )}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save movement"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
