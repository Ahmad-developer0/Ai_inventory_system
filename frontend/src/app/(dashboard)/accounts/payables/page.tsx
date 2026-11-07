import { Alert, PageHeader } from "@/components/ui";
import { OpenBalances } from "@/components/open-balances";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { purchaseToRow } from "@/lib/data";
import type { PurchaseViewRow } from "@/lib/types";

export default async function PayablesPage() {
  await requireManager();
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchases_view").select("*").gt("pending", 0).order("purchase_date");
  return (
    <>
      <PageHeader title="Payables" description="Money owed to suppliers." />
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <OpenBalances rows={(data as PurchaseViewRow[]).map(purchaseToRow)} direction="paid" today={new Date().toISOString().slice(0, 10)} />
      )}
    </>
  );
}
