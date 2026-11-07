import { Plus } from "lucide-react";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";
import { QuotationsTable } from "./quotations-table";
import { getProfile, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { QuotationViewRow } from "@/lib/types";

const workflow = ["Customer", "Items", "Live prices", "Totals", "Discount check", "Approval", "PDF", "Saved"];

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotations_view").select("*").order("id", { ascending: false });
  const quotes = (data ?? []) as QuotationViewRow[];
  const createdQuote = quotes.find((q) => String(q.id) === created);

  return (
    <>
      <PageHeader
        title="Quotations"
        description="A quotation below the minimum price cannot go ahead without manager approval."
        actions={
          <LinkButton href="/quotations/new" icon={Plus}>
            New quotation
          </LinkButton>
        }
      />

      {createdQuote && (
        <div className="mb-4">
          <Alert tone={createdQuote.status === "pending_approval" ? "info" : "success"}>
            {createdQuote.quote_no} saved.
            {createdQuote.status === "pending_approval" ? " It is below the minimum price, so it is waiting for manager approval." : " You can download, print or share it now."}
          </Alert>
        </div>
      )}

      <Card className="mb-6 p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Quotation workflow</p>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {workflow.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">{i + 1}</span>
              <span className="text-slate-700">{step}</span>
              {i < workflow.length - 1 && <span className="text-slate-300">→</span>}
            </li>
          ))}
        </ol>
      </Card>

      {error ? <Alert tone="error">{error.message}</Alert> : <QuotationsTable quotes={quotes} canApprove={isManagerRole(profile)} />}
    </>
  );
}
