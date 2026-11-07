import { ConnectionBanner } from "@/components/connection-banner";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CatalogProduct } from "@/lib/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("product_catalog")
    .select("id, name, sku, stock, unit, reorder_level, stock_status")
    .eq("active", true)
    .in("stock_status", ["low", "out"])
    .order("stock");

  return (
    <div className="min-h-screen">
      <Sidebar profile={profile} />
      <main className="lg:pl-64">
        <ConnectionBanner />
        <Topbar canPurchase={isManagerRole(profile)} alerts={(alerts ?? []) as CatalogProduct[]} />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
