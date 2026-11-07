"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyRow, fieldClass, Table, Td } from "@/components/ui";
import { ProductForm } from "@/components/product-form";
import { StockBadge } from "@/components/status-badges";
import { createClient, errorMessage } from "@/lib/supabase/client";
import { publicFileUrl } from "@/lib/supabase/env";
import { formatPKR } from "@/lib/format";
import { qtyWithUnit, unitShort } from "@/lib/units";
import type { Category, Product } from "@/lib/types";

export function ProductsManager({ products, categories, canEdit }: { products: Product[]; categories: Category[]; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        (showInactive || p.active) &&
        (category === "all" || String(p.category_id) === category) &&
        [p.name, p.sku, p.brand, p.model, p.specifications].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [products, query, category, showInactive]);

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (!error) {
      setMessage({ tone: "success", text: `${p.name} deleted.` });
      return router.refresh();
    }
    if (error.code === "23503" && confirm("This product has stock history or sales, so it cannot be deleted. Mark it inactive instead? (It will be hidden from lists; history is kept.)")) {
      const { error: e2 } = await supabase.from("products").update({ active: false }).eq("id", p.id);
      setMessage(e2 ? { tone: "error", text: errorMessage(e2) } : { tone: "success", text: `${p.name} marked inactive.` });
      return router.refresh();
    }
    setMessage({ tone: "error", text: errorMessage(error) });
  };

  return (
    <>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU, brand, model ya spec…"
              className={`${fieldClass} pl-9`}
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${fieldClass} lg:w-56`}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
          </label>
          {canEdit && (
            <Button icon={Plus} onClick={() => setEditing("new")}>
              Add product
            </Button>
          )}
        </div>

        <Table head={["", "SKU", "Product", "Category", ...(canEdit ? ["Purchase"] : []), "Selling", "Min price", "Stock", "Files", ...(canEdit ? [""] : [])]}>
          {filtered.map((p) => {
            const img = publicFileUrl(p.image_path);
            const sheet = publicFileUrl(p.datasheet_path);
            return (
              <tr key={p.id} className={`hover:bg-slate-50 ${p.active ? "" : "opacity-50"}`}>
                <Td>
                  <Link href={`/products/${p.id}`} className="relative block size-12" title="Open product">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="size-12 rounded-md object-cover ring-1 ring-slate-200 transition hover:ring-amber-500" />
                    ) : (
                      <span className="flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-300 hover:text-slate-500">
                        <ImageIcon size={18} />
                      </span>
                    )}
                    {(p.images?.length ?? 0) > 1 && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-800 px-1.5 text-[10px] font-semibold text-white">{p.images!.length}</span>
                    )}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{p.sku}</Td>
                <Td>
                  <Link href={`/products/${p.id}`} className="font-medium text-slate-900 hover:text-teal-700 hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">{[p.brand, p.model].filter(Boolean).join(" · ")}</p>
                </Td>
                <Td>{p.category_name ?? "—"}</Td>
                {canEdit && <Td className="tabular-nums text-slate-500">{formatPKR(p.purchase_price)}</Td>}
                <Td className="tabular-nums font-medium text-slate-900">
                  {formatPKR(p.selling_price)} <span className="text-xs font-normal text-slate-500">/ {unitShort(p.unit)}</span>
                </Td>
                <Td className="tabular-nums">{formatPKR(p.min_price)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{qtyWithUnit(p.stock, p.unit)}</span>
                    <StockBadge status={p.stock_status} />
                    {!p.active && <Badge>Inactive</Badge>}
                  </div>
                </Td>
                <Td>
                  {sheet ? (
                    <a href={sheet} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline">
                      <FileText size={14} /> Datasheet
                    </a>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </Td>
                {canEdit && (
                  <Td>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(p)} className="text-slate-400 hover:text-slate-800" aria-label="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(p)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Td>
                )}
              </tr>
            );
          })}
        </Table>
        {filtered.length === 0 && <EmptyRow>{products.length === 0 ? "No products yet. Start with Add product." : "No products found."}</EmptyRow>}
      </Card>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMessage({ tone: "success", text });
            router.refresh();
          }}
        />
      )}
    </>
  );
}
