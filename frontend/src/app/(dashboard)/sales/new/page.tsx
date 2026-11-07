import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";
import { getProfile } from "@/lib/auth";
import { loadParties, loadProducts } from "@/lib/data";

export default async function NewSalePage() {
  const profile = await getProfile();
  const [products, customers, suppliers] = await Promise.all([loadProducts(false), loadParties("customers"), loadParties("suppliers")]);
  return (
    <>
      <PageHeader
        title="Add Sale"
        description="Prices come from the product list. Only a manager can go below the minimum price, and quantity cannot exceed stock."
      />
      <InvoiceForm mode="sale" products={products} parties={customers} suppliers={suppliers} role={profile.role} />
    </>
  );
}
