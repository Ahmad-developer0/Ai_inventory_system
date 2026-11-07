import { Alert, PageHeader } from "@/components/ui";
import { OpenBalances } from "@/components/open-balances";
import { createClient } from "@/lib/supabase/server";
import { saleToRow } from "@/lib/data";
import type { SaleViewRow } from "@/lib/types";

export default async function ReceivablesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_view").select("*").gt("pending", 0).order("sale_date");
  return (
    <>
      <PageHeader title="Receivables" description="Money owed by customers (credit sales). Overdue once the payment days have passed." />
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : (
        <OpenBalances rows={(data as SaleViewRow[]).map(saleToRow)} direction="received" today={new Date().toISOString().slice(0, 10)} />
      )}
    </>
  );
}
