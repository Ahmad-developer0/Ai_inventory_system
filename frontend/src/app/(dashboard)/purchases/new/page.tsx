import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";
import { requireManager } from "@/lib/auth";
import { loadParties, loadProducts } from "@/lib/data";

export default async function NewPurchasePage() {
  const profile = await requireManager();
  const [products, suppliers] = await Promise.all([loadProducts(true), loadParties("suppliers")]);
  return (
    <>
      <PageHeader title="Add Purchase" description="Enter the supplier bill. Saving adds stock and sets each product's purchase price to the latest cost." />
      <InvoiceForm mode="purchase" products={products} parties={suppliers} role={profile.role} />
    </>
  );
}
