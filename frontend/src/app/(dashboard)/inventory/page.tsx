import { Badge, Card, EmptyRow, PageHeader, Table, Td } from "@/components/ui";
import { StockBadge } from "@/components/status-badges";
import { StockAdjustButton } from "./stock-adjust";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { qtyWithUnit } from "@/lib/units";
import type { CatalogProduct, StockMovement } from "@/lib/types";

export default async function InventoryPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const [{ data: catalog }, { data: movements }] = await Promise.all([
    supabase.from("product_catalog").select("*").eq("active", true),
    supabase.from("stock_movements_view").select("*").order("id", { ascending: false }).limit(50),
  ]);

  const products = (catalog ?? []) as CatalogProduct[];
  const unitById = new Map(products.map((p) => [p.id, p.unit]));
  // Sab se kam stock (reorder level ke mukable) upar
  const sorted = [...products].sort((a, b) => a.stock / Math.max(1, a.reorder_level) - b.stock / Math.max(1, b.reorder_level));

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock changes only through movements (IN / OUT / ADJUST). Every change is kept in history."
        actions={isManagerRole(profile) && <StockAdjustButton products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, unit: p.unit }))} />}
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Current stock levels" className="xl:col-span-3">
          <Table head={["Product", "On hand", "Reorder level", "Status"]}>
            {sorted.map((p) => (
              <tr key={p.id}>
                <Td>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="font-mono text-xs text-slate-500">{p.sku}</p>
                </Td>
                <Td className="tabular-nums font-medium">{qtyWithUnit(p.stock, p.unit)}</Td>
                <Td className="tabular-nums text-slate-500">{p.reorder_level}</Td>
                <Td>
                  <StockBadge status={p.stock_status} />
                </Td>
              </tr>
            ))}
          </Table>
          {sorted.length === 0 && <EmptyRow>No products yet.</EmptyRow>}
        </Card>

        <Card title="Stock movement history (last 50)" className="xl:col-span-2">
          {(movements ?? []).length === 0 ? (
            <EmptyRow>No movements yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(movements as StockMovement[]).map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{m.product_name}</p>
                    <span className={`tabular-nums text-sm font-semibold ${m.qty > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {m.qty > 0 ? "+" : ""}
                      {qtyWithUnit(m.qty, unitById.get(m.product_id))}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone={m.type === "IN" ? "green" : m.type === "OUT" ? "red" : "amber"}>{m.type}</Badge>
                    <span>{m.reference}</span>
                    {m.note && <span>· {m.note}</span>}
                    {m.created_by_name && <span>· {m.created_by_name}</span>}
                    <span className="ml-auto">{formatDateTime(m.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
