import "server-only";
import type { Party } from "@/components/invoice-form";
import { createClient } from "@/lib/supabase/server";
import { num, type CatalogProduct, type InvoiceRow, type Product, type PurchaseViewRow, type SaleViewRow } from "@/lib/types";

// Active products; manager ke liye purchase_price bhi
export async function loadProducts(withCost: boolean): Promise<Product[]> {
  const supabase = await createClient();
  const [{ data: catalog }, { data: costs }] = await Promise.all([
    supabase.from("product_catalog").select("*").eq("active", true).order("name"),
    withCost ? supabase.from("products").select("id, purchase_price") : Promise.resolve({ data: [] }),
  ]);
  const costById = new Map((costs ?? []).map((c: { id: number; purchase_price: number }) => [c.id, c.purchase_price]));
  return ((catalog ?? []) as CatalogProduct[]).map((p) => ({ ...p, purchase_price: costById.get(p.id) ?? null }));
}

export async function loadParties(table: "customers" | "suppliers") {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select(table === "customers" ? "id, name, phone, type, shop_name" : "id, name, phone, contact_name")
    .order("name");
  return (data ?? []) as unknown as Party[];
}

export function saleToRow(s: SaleViewRow): InvoiceRow {
  return {
    no: s.id,
    date: s.sale_date,
    party: s.party_name,
    mode: s.payment_mode,
    items: num(s.item_count),
    total: num(s.total),
    received: num(s.amount_received),
    pending: num(s.pending),
    paymentDays: s.payment_days,
    dueDate: s.due_date,
    status: s.payment_status,
    tax: num(s.tax),
  };
}

export function purchaseToRow(p: PurchaseViewRow): InvoiceRow {
  return {
    no: p.id,
    date: p.purchase_date,
    party: p.party_name + (p.bill_no ? ` (bill ${p.bill_no})` : ""),
    mode: p.payment_mode,
    items: num(p.item_count),
    total: num(p.total),
    received: num(p.amount_paid),
    pending: num(p.pending),
    paymentDays: p.payment_days,
    dueDate: p.due_date,
    status: p.payment_status,
    tax: num(p.tax),
  };
}
