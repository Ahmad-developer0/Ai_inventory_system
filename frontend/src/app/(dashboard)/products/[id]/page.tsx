import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge, Card, EmptyRow, PageHeader } from "@/components/ui";
import { StockBadge } from "@/components/status-badges";
import { EditProductButton, ProductGallery } from "./product-view";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicFileUrl } from "@/lib/supabase/env";
import { formatDate, formatDateTime, formatPKR } from "@/lib/format";
import { qtyWithUnit, unitShort, UNITS } from "@/lib/units";
import type { CatalogProduct, Category, Product, StockMovement } from "@/lib/types";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const profile = await getProfile();
  const manager = isManagerRole(profile);
  const supabase = await createClient();
  const [{ data: catalog }, { data: cost }, { data: categories }, { data: movements }, { data: bought }] = await Promise.all([
    supabase.from("product_catalog").select("*").eq("id", productId).maybeSingle(),
    manager ? supabase.from("products").select("purchase_price").eq("id", productId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("categories").select("*").order("name"),
    supabase.from("stock_movements_view").select("*").eq("product_id", productId).order("id", { ascending: false }).limit(15),
    manager
      ? supabase.from("purchase_items").select("purchase_id, qty, unit_cost").eq("product_id", productId).order("id", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  // Kis supplier se kis rate par liya
  const boughtItems = (bought ?? []) as { purchase_id: number; qty: number; unit_cost: number }[];
  const { data: boughtFrom } = boughtItems.length
    ? await supabase.from("purchases_view").select("id, purchase_date, bill_no, supplier_id, party_name").in("id", boughtItems.map((b) => b.purchase_id))
    : { data: [] };
  const purchaseInfo = new Map((boughtFrom ?? []).map((p: { id: number; purchase_date: string; bill_no: string | null; supplier_id: number; party_name: string }) => [p.id, p]));
  if (!catalog) notFound();

  const product: Product = { ...(catalog as CatalogProduct), purchase_price: cost?.purchase_price ?? null };
  const photos = product.images?.length ? product.images : product.image_path ? [product.image_path] : [];
  const sheet = publicFileUrl(product.datasheet_path);
  const u = unitShort(product.unit);
  const specs = (product.specifications ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  const details: [string, React.ReactNode][] = [
    ["SKU", <span key="sku" className="font-mono">{product.sku}</span>],
    ["Brand", product.brand ?? "—"],
    ["Model", product.model ?? "—"],
    ["Category", product.category_name ?? "—"],
    ["Unit", UNITS.find((x) => x.value === product.unit)?.label ?? "Pieces"],
    ["Reorder level", qtyWithUnit(product.reorder_level, product.unit)],
  ];

  return (
    <>
      <Link href="/products" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Products
      </Link>
      <PageHeader
        title={product.name}
        description={[product.brand, product.model, product.category_name].filter(Boolean).join(" · ")}
        actions={manager && <EditProductButton product={product} categories={(categories ?? []) as Category[]} />}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ProductGallery paths={photos} name={product.name} />
          <p className="mt-2 text-xs text-slate-500">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
            {photos.length < 4 && manager ? " · add at least 4 so the AI assistant can share them with customers" : ""}
          </p>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Selling price</p>
                <p className="text-xl font-semibold tabular-nums text-slate-900">
                  {formatPKR(product.selling_price)} <span className="text-sm font-normal text-slate-500">/ {u}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Minimum price</p>
                <p className="text-xl font-semibold tabular-nums text-slate-900">{formatPKR(product.min_price)}</p>
              </div>
              {manager && (
                <div>
                  <p className="text-xs text-slate-500">Purchase price</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-500">{formatPKR(product.purchase_price)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">In stock</p>
                <p className="flex items-center gap-2 text-xl font-semibold tabular-nums text-slate-900">
                  {qtyWithUnit(product.stock, product.unit)} <StockBadge status={product.stock_status} />
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1">{product.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</p>
              </div>
            </div>
          </Card>

          <Card title="Details">
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card
            title="Technical specifications"
            action={
              sheet ? (
                <a href={sheet} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
                  <FileText size={14} /> Open datasheet
                </a>
              ) : undefined
            }
          >
            {specs.length ? (
              <ul className="divide-y divide-slate-100">
                {specs.map((line, i) => {
                  const [k, ...rest] = line.split(":");
                  return (
                    <li key={i} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                      {rest.length ? (
                        <>
                          <span className="text-slate-500">{k.trim()}</span>
                          <span className="text-right font-medium text-slate-900">{rest.join(":").trim()}</span>
                        </>
                      ) : (
                        <span className="text-slate-800">{line}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyRow>No specifications yet.</EmptyRow>
            )}
          </Card>

          {manager && (
            <Card title="Purchase history (supplier and rate)">
              {boughtItems.length ? (
                <ul className="divide-y divide-slate-100">
                  {boughtItems.map((b, i) => {
                    const info = purchaseInfo.get(b.purchase_id);
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <span className="min-w-0">
                          {info ? (
                            <Link href={`/suppliers/${info.supplier_id}`} className="font-medium text-teal-700 hover:underline">
                              {info.party_name.replace(/ \(bill .*\)$/, "")}
                            </Link>
                          ) : (
                            "—"
                          )}
                          <span className="ml-2 text-xs text-slate-500">
                            {info ? formatDate(info.purchase_date) : ""} {info?.bill_no ? `· bill ${info.bill_no}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {qtyWithUnit(b.qty, product.unit)} × <span className="font-semibold">{formatPKR(b.unit_cost)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyRow>Not bought from any supplier yet.</EmptyRow>
              )}
            </Card>
          )}

          <Card title="Recent stock movements">
            {(movements ?? []).length ? (
              <ul className="divide-y divide-slate-100">
                {(movements as StockMovement[]).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <Badge tone={m.type === "IN" ? "green" : m.type === "OUT" ? "red" : "amber"}>{m.type}</Badge>
                      <span className="text-slate-600">{m.reference}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className={`font-semibold tabular-nums ${m.qty > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {m.qty > 0 ? "+" : ""}
                        {qtyWithUnit(m.qty, product.unit)}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(m.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>No stock movements yet.</EmptyRow>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
