"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Alert, Card, fieldClass } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { qtyWithUnit, unitShort } from "@/lib/units";
import { num, type Product } from "@/lib/types";

export function POS({ products }: { products: Product[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cash, setCash] = useState<number | "">("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = products.filter((p) => [p.name, p.sku, p.brand].some((f) => f?.toLowerCase().includes(query.toLowerCase())));
  const lines = Object.entries(cart).map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id))!, qty }));
  const total = lines.reduce((s, l) => s + l.qty * num(l.product.selling_price), 0);
  const change = typeof cash === "number" ? cash - total : 0;

  const setQty = (id: number, qty: number) => {
    const stock = products.find((p) => p.id === id)!.stock;
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, stock);
      return next;
    });
    setDone(null);
    setError("");
  };

  const checkout = async () => {
    setSaving(true);
    setError("");
    const { data, error } = await createClient().rpc("create_sale", {
      p_buyer_type: "customer",
      p_name: name,
      p_shop_name: null,
      p_phone: phone,
      p_payment_mode: "Cash",
      p_payment_days: 0,
      p_amount_received: total,
      p_apply_tax: false,
      p_items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty, discount_pct: 0 })),
    });
    setSaving(false);
    if (error) return setError(errorMessage(error));
    setDone(`Invoice #${data}: ${formatPKR(total)}${change > 0 ? `, change ${formatPKR(change)}` : ""}.`);
    setCart({});
    setCash("");
    setName("");
    setPhone("");
    router.refresh(); // stock numbers update
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or SKU…" className={`${fieldClass} py-2.5 pl-9`} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((p) => {
            const out = p.stock === 0;
            return (
              <button
                key={p.id}
                disabled={out}
                onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="line-clamp-2 text-sm font-medium text-slate-900">{p.name}</p>
                <p className="mt-1 text-xs text-slate-500">{p.brand}</p>
                <p className="mt-3 font-semibold tabular-nums text-teal-700">
                  {formatPKR(p.selling_price)} <span className="text-xs font-normal text-slate-500">/ {unitShort(p.unit)}</span>
                </p>
                <p className={`text-xs ${out ? "text-red-600" : "text-slate-500"}`}>{out ? "Out of stock" : `Stock: ${qtyWithUnit(p.stock, p.unit)}`}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Card title="Cart" className="h-fit lg:sticky lg:top-20">
        {lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Cart is empty.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {qtyWithUnit(qty, product.unit)} · {formatPKR(num(product.selling_price) * qty)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(product.id, qty - 1)} className="rounded border border-slate-300 p-1" aria-label="Decrease">
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={qty || ""}
                    placeholder="0"
                    onChange={(e) =>
                      // Khali karne par item cart mein rahe (0); sirf trash ya minus se hate
                      e.target.value === "" ? setCart((c) => ({ ...c, [product.id]: 0 })) : setQty(product.id, Number(e.target.value))
                    }
                    className="w-16 rounded border border-slate-300 px-1 text-center text-sm tabular-nums"
                    aria-label="Quantity"
                  />
                  <button onClick={() => setQty(product.id, qty + 1)} className="rounded border border-slate-300 p-1" aria-label="Increase">
                    <Plus size={12} />
                  </button>
                  <button onClick={() => setQty(product.id, 0)} className="ml-1 text-slate-400 hover:text-red-600" aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-3 border-t border-slate-100 p-5">
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatPKR(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name *" className={fieldClass} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="WhatsApp number *" className={fieldClass} />
          </div>
          <input
            type="number"
            value={cash}
            onChange={(e) => setCash(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Cash received"
            className={fieldClass}
          />
          {typeof cash === "number" && (
            <p className={`flex justify-between text-sm ${change < 0 ? "text-red-600" : "text-emerald-700"}`}>
              <span>{change < 0 ? "Short by" : "Change due"}</span>
              <span className="tabular-nums">{formatPKR(Math.abs(change))}</span>
            </p>
          )}
          <button
            onClick={checkout}
            disabled={saving || lines.length === 0 || lines.some((l) => l.qty <= 0) || !name.trim() || !phone.trim() || (typeof cash === "number" && change < 0)}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Complete sale"}
          </button>
          {error && <Alert tone="error">{error}</Alert>}
          {done && (
            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              {done}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
