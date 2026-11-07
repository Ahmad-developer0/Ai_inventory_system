import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";
import { getProfile } from "@/lib/auth";
import { loadParties, loadProducts } from "@/lib/data";

export default async function NewQuotationPage() {
  const profile = await getProfile();
  const [products, customers] = await Promise.all([loadProducts(false), loadParties("customers")]);
  return (
    <>
      <PageHeader title="New Quotation" description="Prices come from the product list. A discount below the minimum price needs manager approval." />
      <InvoiceForm mode="quotation" products={products} parties={customers} role={profile.role} />
    </>
  );
}
