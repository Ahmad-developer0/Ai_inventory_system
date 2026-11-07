import { Plus } from "lucide-react";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { InvoiceTable } from "@/components/invoice-table";
import { BillActions } from "@/components/bill-actions";
import { createClient } from "@/lib/supabase/server";
import { saleToRow } from "@/lib/data";
import type { SaleViewRow } from "@/lib/types";

export default async function SalesInvoicesPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_view").select("*").order("id", { ascending: false });

  return (
    <>
      <PageHeader
        title="Sales Invoices"
        description="All sales: cash, bank, cheque and credit (due). Every sale reduces stock automatically."
        actions={
          <LinkButton href="/sales/new" icon={Plus}>
            Add sale
          </LinkButton>
        }
      />
      {created && (
        <div className="mb-4">
          <Alert tone="success">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Invoice #{created} saved and stock updated. Bill for the customer:</span>
              <BillActions kind="sale" id={Number(created)} size="lg" />
            </div>
          </Alert>
        </div>
      )}
      {error ? <Alert tone="error">{error.message}</Alert> : <InvoiceTable rows={(data as SaleViewRow[]).map(saleToRow)} kind="sale" filename="sales-invoices" />}
    </>
  );
}
