import { Plus } from "lucide-react";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { InvoiceTable } from "@/components/invoice-table";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { purchaseToRow } from "@/lib/data";
import type { PurchaseViewRow } from "@/lib/types";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await requireManager();
  const { created } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchases_view").select("*").order("id", { ascending: false });

  return (
    <>
      <PageHeader
        title="Purchase Invoices"
        description="Goods bought from suppliers. Every purchase adds stock and updates the product cost."
        actions={
          <LinkButton href="/purchases/new" variant="red" icon={Plus}>
            Add purchase
          </LinkButton>
        }
      />
      {created && (
        <div className="mb-4">
          <Alert tone="success">Purchase #{created} saved and stock increased.</Alert>
        </div>
      )}
      {error ? <Alert tone="error">{error.message}</Alert> : <InvoiceTable rows={(data as PurchaseViewRow[]).map(purchaseToRow)} kind="purchase" filename="purchase-invoices" />}
    </>
  );
}
