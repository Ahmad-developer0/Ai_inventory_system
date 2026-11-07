import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { ReturnNotesTable } from "@/components/return-notes-table";
import { creditNotes } from "@/lib/demo-data";

export default function SalesReturnsPage() {
  return (
    <>
      <PageHeader demo
        title="Credit Note / Sales Return"
        description="Goods returned by customers. Good items go back into stock as an IN movement."
        actions={<Button icon={Plus}>New credit note</Button>}
      />
      <ReturnNotesTable rows={creditNotes} partyLabel="Customer" invoiceLabel="Against invoice" />
    </>
  );
}
