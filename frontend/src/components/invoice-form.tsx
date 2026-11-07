"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Alert, Card, Field, fieldClass } from "@/components/ui";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";
import { qtyWithUnit, unitShort, UNITS } from "@/lib/units";
import { num, PAYMENT_MODES, type PaymentMode, type Product, type Role } from "@/lib/types";

type Mode = "sale" | "purchase" | "quotation";

const config: Record<Mode, { party: string; save: string; payment: boolean; listPath: string }> = {
  sale: { party: "Customer", save: "Save sale invoice", payment: true, listPath: "/sales/invoices" },
  purchase: { party: "Supplier", save: "Save purchase", payment: true, listPath: "/purchases" },
  quotation: { party: "Customer", save: "Save quotation", payment: false, listPath: "/quotations" },
};

interface Line {
  key: number;
  productId: number | "";
  qty: number;
  discountPct: number;
  unitCost: number; // sirf purchase
  // Purchase: product ka naam likha jata hai; naya ho to unit aur selling price bhi
  productName: string;
  newUnit: string;
  newSelling: string;
  newMin: string;
  totalCost: string; // purchase: kul raqam likhi ho to per piece cost usi se banti hai
}

const newLine = (): Line => ({
  key: Date.now() + Math.random(),
  productId: "",
  qty: 0, // khali dikhta hai; user khud likhta hai
  discountPct: 0,
  unitCost: 0,
  productName: "",
  newUnit: "pcs",
  newSelling: "",
  newMin: "",
  totalCost: "",
});

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Naye product ka SKU khud ban jata hai, e.g. "SOLAR-PANEL-550W-K3F2"
const autoSku = (name: string) =>
  `${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

// Price hamesha product list (database) se aati hai. Asal checks database functions mein dobara hote hain;
// yahan sirf user ko pehle se batane ke liye hain.
type Buyer = "customer" | "shopkeeper" | "supplier";

export interface Party {
  id: number;
  name: string;
  phone?: string | null;
  type?: string | null; // customers: Shopkeeper / Retail / Dealer / Installer
  shop_name?: string | null; // shopkeepers
  contact_name?: string | null; // suppliers
}

// Sale par buyer ki details likhi jati hain; database shopkeeper/supplier ko phone se pehchaan leta hai ya naya bana deta hai
const BUYERS: { value: Buyer; label: string; name: string; shop?: string; phone: string; nameRequired: boolean }[] = [
  { value: "customer", label: "Customer (walk-in)", name: "Customer name", phone: "WhatsApp number", nameRequired: true },
  { value: "shopkeeper", label: "Shopkeeper", name: "Shopkeeper name", shop: "Shop name", phone: "Mobile number", nameRequired: true },
  { value: "supplier", label: "Supplier", name: "Contact person", shop: "Company / shop name", phone: "Phone number", nameRequired: false },
];

const phoneKey = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

export function InvoiceForm({
  mode,
  products,
  parties,
  suppliers = [],
  role,
}: {
  mode: Mode;
  products: Product[];
  parties: Party[];
  suppliers?: Party[]; // sale only: selling to a supplier
  role: Role;
}) {
  const router = useRouter();
  const cfg = config[mode];
  const isPurchase = mode === "purchase";
  const isManager = role === "admin" || role === "manager";

  const [buyer, setBuyer] = useState<Buyer>("customer");
  const [partyId, setPartyId] = useState<string>(String(parties[0]?.id ?? "")); // purchase / quotation
  const [buyerName, setBuyerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [billNo, setBillNo] = useState("");
  const [validDays, setValidDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [payMode, setPayMode] = useState<PaymentMode>("Cash");
  const [paymentDays, setPaymentDays] = useState(0);
  const [amount, setAmount] = useState<number | "">("");
  const [remainder, setRemainder] = useState<"pending" | "less">("pending"); // sale: kam payment ka baqi hissa
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const buyerCfg = BUYERS.find((b) => b.value === buyer)!;
  // Pehle se saved shopkeepers / suppliers: number likhne par naam khud bhar jata hai
  const supplierMode = isPurchase || buyer === "supplier"; // purchase par parties = suppliers
  const known = isPurchase ? parties : buyer === "supplier" ? suppliers : buyer === "shopkeeper" ? parties.filter((p) => p.type === "Shopkeeper") : [];
  const findByPhone = (value: string) => (phoneKey(value).length === 10 ? known.find((p) => phoneKey(p.phone) === phoneKey(value)) : undefined);
  // Purchase: number na ho to company ke naam se bhi purana supplier mil jata hai
  const match = findByPhone(phone) ?? (isPurchase && !phone.trim() ? known.find((p) => p.name.trim().toLowerCase() === shopName.trim().toLowerCase()) : undefined);
  const fillFrom = (found: Party) => {
    setShopName(supplierMode ? found.name : (found.shop_name ?? ""));
    setBuyerName(supplierMode ? (found.contact_name ?? "") : found.name);
    if (found.phone) setPhone(found.phone);
  };
  const onPhone = (value: string) => {
    setPhone(value);
    const found = findByPhone(value);
    if (found) fillFrom(found);
  };
  const chooseBuyer = (b: Buyer) => {
    setBuyer(b);
    setBuyerName("");
    setShopName("");
    setPhone("");
  };
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const rows = lines.map((l) => {
    const product = isPurchase ? products.find((p) => !!l.productName.trim() && sameName(p.name, l.productName)) : products.find((p) => p.id === l.productId);
    const isNew = isPurchase && !product && !!l.productName.trim();
    const listPrice = isPurchase ? l.unitCost : product ? num(product.selling_price) : 0;
    const unitNet = isPurchase ? listPrice : Math.round(listPrice * (1 - l.discountPct / 100) * 100) / 100;
    const belowMin = !isPurchase && !!product && unitNet < num(product.min_price);
    const overStock = mode === "sale" && !!product && l.qty > product.stock;
    const amount = isPurchase && l.totalCost !== "" ? Number(l.totalCost) : unitNet * l.qty;
    return { ...l, product, isNew, listPrice, amount, belowMin, overStock };
  });

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const grandTotal = subtotal; // sales tax istemal nahi hota
  const isSale = mode === "sale";
  // Sale par received raqam likhna zaroori hai; purchase par khali = poori payment
  const received = payMode === "Due" ? 0 : amount === "" ? (isSale ? 0 : grandTotal) : amount;
  const short = Math.max(grandTotal - received, 0);
  const change = isSale ? Math.max(received - grandTotal, 0) : 0;
  const less = isSale && payMode !== "Due" && remainder === "less" ? short : 0;
  const netTotal = grandTotal - less;
  const paid = Math.min(received, netTotal);
  const pending = netTotal - paid;
  // Salesperson bill ko minimum prices se neeche "less" nahi kar sakta
  const minTotal = rows.reduce((s, r) => s + (r.product ? num(r.product.min_price) * r.qty : 0), 0);
  const maxLess = Math.max(subtotal - minTotal, 0);
  const lessTooHigh = isSale && !isManager && less > maxLess + 0.001;
  const amountMissing = isSale && payMode !== "Due" && amount === "";

  const blockedByPrice = mode === "sale" && !isManager && rows.some((r) => r.belowMin);
  const needsApproval = mode === "quotation" && rows.some((r) => r.belowMin);
  const hasStockIssue = rows.some((r) => r.overStock);
  const hasEmpty = rows.some(
    (r) => r.qty <= 0 || (isPurchase ? !r.productName.trim() || (r.isNew && !(Number(r.newSelling) > 0)) : !r.product),
  );
  const buyerMissing =
    mode === "sale" && (phoneKey(phone).length < 10 || (buyerCfg.nameRequired && !buyerName.trim()) || (!!buyerCfg.shop && !shopName.trim()));
  const noParty = isPurchase ? !shopName.trim() || (!!phone.trim() && phoneKey(phone).length < 10) : mode === "quotation" && !partyId;
  const dueDate = new Date(Date.now() + paymentDays * 86_400_000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const submit = async () => {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const items = rows.map((r) =>
      isPurchase ? { product_id: r.productId, qty: r.qty, unit_cost: r.unitCost } : { product_id: r.productId, qty: r.qty, discount_pct: r.discountPct },
    );
    const amountParam = payMode === "Due" ? 0 : isSale ? paid : amount === "" ? null : amount;

    const { data, error } =
      mode === "sale"
        ? await supabase.rpc("create_sale", {
            p_buyer_type: buyer,
            p_name: buyerName,
            p_shop_name: shopName,
            p_phone: phone,
            p_payment_mode: payMode,
            p_payment_days: paymentDays,
            p_amount_received: amountParam,
            p_apply_tax: false,
            p_items: items,
            p_less_amount: less,
          })
        : mode === "purchase"
          ? await (async () => {
              // Supplier pehle se ho to wahi, warna naya bana do
              let supplierId = match?.id;
              if (!supplierId) {
                const { data: created, error: supErr } = await supabase
                  .from("suppliers")
                  .insert({ name: shopName.trim(), contact_name: buyerName.trim() || null, phone: phone.trim() || null })
                  .select("id")
                  .single();
                if (supErr) return { data: null, error: supErr };
                supplierId = created.id as number;
              }
              // Naye naam wale products pehle bana do (aik naam aik dafa)
              const newIds = new Map<string, number>();
              for (const r of rows) {
                const key = r.productName.trim().toLowerCase();
                if (r.product || newIds.has(key)) continue;
                const selling = Number(r.newSelling);
                const min = r.newMin.trim() ? Math.min(Number(r.newMin), selling) : selling;
                const { data: np, error: pErr } = await supabase
                  .from("products")
                  .insert({ sku: autoSku(r.productName), name: r.productName.trim(), unit: r.newUnit, purchase_price: r.unitCost, selling_price: selling, min_price: min })
                  .select("id")
                  .single();
                if (pErr) return { data: null, error: pErr };
                newIds.set(key, np.id as number);
              }
              const purchaseItems = rows.map((r) => ({
                product_id: r.product?.id ?? newIds.get(r.productName.trim().toLowerCase()),
                qty: r.qty,
                unit_cost: r.unitCost,
              }));
              return supabase.rpc("create_purchase", {
              p_supplier_id: supplierId,
              p_bill_no: billNo,
              p_payment_mode: payMode,
              p_payment_days: paymentDays,
              p_amount_paid: amountParam,
              p_apply_tax: false,
              p_items: purchaseItems,
              });
            })()
          : await supabase.rpc("create_quotation", {
              p_customer_id: Number(partyId),
              p_valid_days: validDays,
              p_apply_tax: false,
              p_notes: notes,
              p_items: items,
            });

    setSaving(false);
    if (error) return setError(errorMessage(error));
    router.push(`${cfg.listPath}?created=${data}`);
    router.refresh();
  };

  if (parties.length === 0 && mode === "quotation") {
    return <Alert tone="info">First add a customer (Sales → Customers).</Alert>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card title="Details">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {mode === "sale" ? (
              <>
                <Field label="Sold to">
                  <select value={buyer} onChange={(e) => chooseBuyer(e.target.value as Buyer)} className={fieldClass}>
                    {BUYERS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`${buyerCfg.phone} *`}>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => onPhone(e.target.value)}
                    className={fieldClass}
                    placeholder="0300 1234567"
                    list={known.length ? `known-${buyer}` : undefined}
                  />
                  {known.length > 0 && (
                    <datalist id={`known-${buyer}`}>
                      {known.map((p) => (
                        <option key={p.id} value={p.phone ?? ""}>
                          {buyer === "supplier" ? p.name : `${p.shop_name ?? ""} (${p.name})`}
                        </option>
                      ))}
                    </datalist>
                  )}
                </Field>
                {buyerCfg.shop && (
                  <Field label={`${buyerCfg.shop} *`}>
                    <input required value={shopName} onChange={(e) => setShopName(e.target.value)} className={fieldClass} placeholder={buyer === "supplier" ? "Hall Road Traders" : "Imran Electric Store"} />
                  </Field>
                )}
                <Field label={`${buyerCfg.name}${buyerCfg.nameRequired ? " *" : ""}`}>
                  <input required={buyerCfg.nameRequired} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={fieldClass} placeholder="Muhammad Ali" />
                </Field>
                {buyer !== "customer" && (
                  <p className="text-xs text-slate-500 sm:col-span-2">
                    {match
                      ? `Saved ${buyer} found for this number. The sale goes to their existing record.`
                      : `New number: a ${buyer} record will be created when you save, so their purchases, quantities and pending bills stay together.`}
                  </p>
                )}
              </>
            ) : isPurchase ? (
              <>
                <Field label="Company / shop name *">
                  <input
                    required
                    value={shopName}
                    onChange={(e) => {
                      setShopName(e.target.value);
                      const found = known.find((p) => p.name.trim().toLowerCase() === e.target.value.trim().toLowerCase());
                      if (found && !phone.trim()) fillFrom(found);
                    }}
                    className={fieldClass}
                    placeholder="Growatt Pakistan Distributor"
                    list="known-suppliers-by-name"
                  />
                  <datalist id="known-suppliers-by-name">
                    {known.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.phone ?? ""}
                      </option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Phone number">
                  <input type="tel" value={phone} onChange={(e) => onPhone(e.target.value)} className={fieldClass} placeholder="0300 1234567" />
                </Field>
                <Field label="Contact person">
                  <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={fieldClass} placeholder="Kashif" />
                </Field>
                <p className="self-end pb-2 text-xs text-slate-500">
                  {match
                    ? "Saved supplier found. This purchase goes to their existing record."
                    : shopName.trim()
                      ? "New supplier: their record will be created when you save."
                      : "Type the supplier name. Saved suppliers show as suggestions."}
                </p>
              </>
            ) : (
              <Field label={cfg.party}>
                <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className={fieldClass}>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {isPurchase && (
              <Field label="Supplier bill no.">
                <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={fieldClass} />
              </Field>
            )}
            {mode === "quotation" && (
              <>
                <Field label="Valid for (days)">
                  <input type="number" min={1} value={validDays || ""} onChange={(e) => setValidDays(Number(e.target.value))} className={fieldClass} placeholder="7" />
                </Field>
                <Field label="Notes (printed on the PDF)" className="sm:col-span-2">
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} placeholder="Delivery in 3 days, 2-year warranty…" />
                </Field>
              </>
            )}
          </div>
        </Card>

        <Card
          title="Items"
          action={
            <button onClick={() => setLines((ls) => [...ls, newLine()])} className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline">
              <Plus size={16} /> Add item
            </button>
          }
        >
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.key} className="p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12 sm:items-end">
                  {isPurchase ? (
                    <label className="col-span-2 sm:col-span-4">
                      <span className="mb-1 block text-xs text-slate-500">Product name</span>
                      <input
                        value={r.productName}
                        onChange={(e) => {
                          const name = e.target.value;
                          const p = products.find((x) => !!name.trim() && sameName(x.name, name));
                          update(r.key, { productName: name, ...(p ? { unitCost: num(p.purchase_price) } : {}) });
                        }}
                        className={fieldClass}
                        placeholder="Type the product name"
                      />
                    </label>
                  ) : (
                  <label className="col-span-2 sm:col-span-5">
                    <span className="mb-1 block text-xs text-slate-500">Product</span>
                    <select
                      value={r.productId}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : "";
                        const p = products.find((x) => x.id === id);
                        update(r.key, { productId: id, unitCost: p ? num(p.purchase_price) : 0 });
                      }}
                      className={fieldClass}
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={mode === "sale" && p.stock === 0}>
                          {p.name} ({p.sku}) · {qtyWithUnit(p.stock, p.unit)} in stock
                        </option>
                      ))}
                    </select>
                  </label>
                  )}
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs text-slate-500">Qty{r.product ? ` (${unitShort(r.product.unit)})` : ""}</span>
                    <input type="number" min={1} value={r.qty || ""} placeholder="0" onChange={(e) => {
                        const qty = Number(e.target.value);
                        // Total cost likhi ho to woh wahi rahe, per piece dobara nikle
                        update(r.key, { qty, ...(isPurchase && r.totalCost !== "" ? { unitCost: qty > 0 ? Math.round((Number(r.totalCost) / qty) * 100) / 100 : 0 } : {}) });
                      }} className={fieldClass} />
                  </label>
                  {isPurchase ? (
                    <>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs text-slate-500">Cost per {unitShort(r.product?.unit ?? r.newUnit)}</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.unitCost || ""}
                          onChange={(e) => update(r.key, { unitCost: Number(e.target.value), totalCost: "" })}
                          className={fieldClass}
                          placeholder="0"
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs text-slate-500">Total cost</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.totalCost !== "" ? r.totalCost : r.unitCost * r.qty || ""}
                          onChange={(e) =>
                            update(r.key, {
                              totalCost: e.target.value,
                              unitCost: r.qty > 0 ? Math.round((Number(e.target.value) / r.qty) * 100) / 100 : 0,
                            })
                          }
                          className={fieldClass}
                          placeholder="0"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-xs text-slate-500">Price</span>
                        <p className="py-2 text-sm tabular-nums text-slate-700">
                          {formatPKR(r.listPrice)}
                          {r.product && <span className="text-xs text-slate-500"> / {unitShort(r.product.unit)}</span>}
                        </p>
                      </div>
                      <label className="sm:col-span-1">
                        <span className="mb-1 block text-xs text-slate-500">Disc %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={r.discountPct || ""}
                          placeholder="0"
                          onChange={(e) => update(r.key, { discountPct: Number(e.target.value) })}
                          className={fieldClass}
                        />
                      </label>
                    </>
                  )}
                  <div className={`flex items-center justify-between gap-2 ${isPurchase ? "sm:col-span-2 sm:justify-end" : "sm:col-span-2"}`}>
                    {!isPurchase && <span className="tabular-nums text-sm font-medium text-slate-900">{formatPKR(r.amount)}</span>}
                    <button
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== r.key) : ls))}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {isPurchase && r.qty > 0 && r.amount > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    {qtyWithUnit(r.qty, r.product?.unit ?? r.newUnit)} × {formatPKR(r.unitCost)} per {unitShort(r.product?.unit ?? r.newUnit)} ={" "}
                    <span className="font-semibold text-slate-900">{formatPKR(r.amount)}</span>
                    {r.product && num(r.product.purchase_price) > 0 && num(r.product.purchase_price) !== r.unitCost && (
                      <span className={`ml-2 ${r.unitCost > num(r.product.purchase_price) ? "text-red-600" : "text-emerald-700"}`}>
                        (last cost {formatPKR(r.product.purchase_price)})
                      </span>
                    )}
                  </p>
                )}
                {r.isNew && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3">
                    <p className="mb-2 text-xs font-medium text-amber-800">New product: it will be added to your product list when you save.</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <label>
                        <span className="mb-1 block text-xs text-slate-500">Unit</span>
                        <select value={r.newUnit} onChange={(e) => update(r.key, { newUnit: e.target.value })} className={fieldClass}>
                          {UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-xs text-slate-500">Selling price / {unitShort(r.newUnit)} *</span>
                        <input type="number" min={0} value={r.newSelling} onChange={(e) => update(r.key, { newSelling: e.target.value })} className={fieldClass} />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs text-slate-500">Minimum price (blank = selling)</span>
                        <input type="number" min={0} value={r.newMin} onChange={(e) => update(r.key, { newMin: e.target.value })} className={fieldClass} />
                      </label>
                    </div>
                  </div>
                )}
                {r.product && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-500">Stock: {qtyWithUnit(r.product.stock, r.product.unit)}</span>
                    {r.belowMin && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <AlertTriangle size={12} /> Below minimum price {formatPKR(r.product.min_price)}
                        {mode === "quotation" ? ": needs manager approval" : isManager ? " (allowed for managers)" : ": cannot sell, create a quotation"}
                      </span>
                    )}
                    {r.overStock && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle size={12} /> Only {qtyWithUnit(r.product.stock, r.product.unit)} in stock
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {cfg.payment && (
          <Card title="Payment">
            <div className="grid gap-4 p-5">
              <Field label="Mode of payment">
                <select value={payMode} onChange={(e) => setPayMode(e.target.value as PaymentMode)} className={fieldClass}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              {payMode !== "Due" && (
                <Field label={isSale ? "Amount received *" : "Amount paid (blank = full)"}>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className={`${fieldClass} text-base font-semibold`}
                      placeholder={isSale ? "Cash the customer gave" : ""}
                    />
                    {isSale && (
                      <button
                        type="button"
                        onClick={() => setAmount(grandTotal)}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        title="Fill the full bill amount"
                      >
                        Full
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {isSale && payMode !== "Due" && amount !== "" && short > 0 && (
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="mb-2 text-sm text-slate-700">
                    Remaining <span className="font-semibold text-slate-900">{formatPKR(short)}</span>:
                  </p>
                  <label className="mb-1 flex items-center gap-2 text-sm">
                    <input type="radio" checked={remainder === "pending"} onChange={() => setRemainder("pending")} />
                    Keep as pending (credit)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={remainder === "less"} onChange={() => setRemainder("less")} />
                    Less (reduce the bill by {formatPKR(short)})
                  </label>
                  {lessTooHigh && (
                    <p className="mt-2 text-xs text-red-600">
                      Too much less: you can less up to {formatPKR(maxLess)} (minimum prices). A manager can approve more.
                    </p>
                  )}
                </div>
              )}
              {change > 0 && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Change to return: {formatPKR(change)}</p>
              )}
              <Field label="Payment days (credit period)">
                <input type="number" min={0} value={paymentDays || ""} onChange={(e) => setPaymentDays(Number(e.target.value))} className={fieldClass} placeholder="0" />
              </Field>
              {pending > 0 && <p className="text-xs text-slate-500">Balance due date: {dueDate}</p>}
            </div>
          </Card>
        )}

        <Card title="Summary">
          <dl className="space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">{formatPKR(subtotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatPKR(grandTotal)}</dd>
            </div>
            {less > 0 && (
              <>
                <div className="flex justify-between text-amber-700">
                  <dt>Less</dt>
                  <dd className="tabular-nums">−{formatPKR(less)}</dd>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <dt>Net total</dt>
                  <dd className="tabular-nums">{formatPKR(netTotal)}</dd>
                </div>
              </>
            )}
            {cfg.payment && (
              <>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{isPurchase ? "Paid" : "Received"}</dt>
                  <dd className="tabular-nums">{formatPKR(isSale ? received : paid)}</dd>
                </div>
                {change > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Change to return</dt>
                    <dd className="tabular-nums">{formatPKR(change)}</dd>
                  </div>
                )}
                <div className={`flex justify-between font-medium ${pending > 0 ? "text-red-600" : "text-emerald-700"}`}>
                  <dt>Pending</dt>
                  <dd className="tabular-nums">{formatPKR(pending)}</dd>
                </div>
              </>
            )}
          </dl>
          <div className="space-y-3 border-t border-slate-100 p-5">
            {error && <Alert tone="error">{error}</Alert>}
            {blockedByPrice && <Alert tone="info">Selling below the minimum price needs manager approval. Create a quotation instead.</Alert>}
            {amountMissing && !hasEmpty && <Alert tone="info">Enter the amount received (or press Full).</Alert>}
            {buyerMissing && <Alert tone="info">Fill in the buyer details: {[buyerCfg.nameRequired && buyerCfg.name, buyerCfg.shop, buyerCfg.phone].filter(Boolean).join(", ")}.</Alert>}
            <button
              onClick={submit}
              disabled={saving || hasEmpty || hasStockIssue || blockedByPrice || buyerMissing || noParty || amountMissing || lessTooHigh}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : needsApproval ? "Save & send for manager approval" : cfg.save}
            </button>
            {hasEmpty && <p className="text-xs text-slate-500">Every line needs a product{isPurchase ? " name (and a selling price if it is new)" : ""} and quantity.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
