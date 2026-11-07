import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { ReturnNotesTable } from "@/components/return-notes-table";
import { purchaseReturns } from "@/lib/demo-data";

export default function PurchaseReturnsPage() {
  return (
    <>
      <PageHeader demo
        title="Debit Note / Purchase Return"
        description="Goods returned to a supplier. Stock goes out and the supplier balance goes down."
        actions={<Button icon={Plus}>New debit note</Button>}
      />
      <ReturnNotesTable rows={purchaseReturns} partyLabel="Supplier" invoiceLabel="Against bill" />
    </>
  );
}
