import { getProducts } from "@/lib/queries/products";
import { getHospitals } from "@/lib/queries/hospitals";
import { ProductSearch, ProductTable } from "@/components/product-list";
import { RealtimeListener } from "@/components/realtime-listener";

export default async function MyProductsPage() {
  const [{ products }, { hospitals }] = await Promise.all([
    getProducts({}).catch(() => ({ products: [], total: 0 })),
    getHospitals().catch(() => ({ hospitals: [], total: 0 })),
  ]);

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">내 품목</h1>
        <p className="text-sm text-muted-foreground mt-1">
          주문에서 선택한 품목을 관리합니다.
        </p>
      </div>
      <ProductSearch />
      <ProductTable products={products} hospitals={hospitals} />
      <RealtimeListener tables={["products"]} />
    </>
  );
}
