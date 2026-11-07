import { PageHeader } from "@/components/ui";
import { POS } from "./pos";
import { loadProducts } from "@/lib/data";

export default async function POSPage() {
  const products = await loadProducts(false);
  return (
    <>
      <PageHeader title="POS Sales" description="Quick counter sale. Click products, enter cash received, and complete the sale." />
      <POS products={products} />
    </>
  );
}
