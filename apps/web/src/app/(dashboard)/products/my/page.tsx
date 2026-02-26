import { getProducts } from "@/lib/queries/products";
import { getHospitals } from "@/lib/queries/hospitals";
import { ProductSearch, ProductTable } from "@/components/product-list";
import { RealtimeListener } from "@/components/realtime-listener";

export default async function MyProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const category = params.category ?? "";
  const pageParam = Number(params.page ?? "1");
  const limit = 25;
  const offset = (pageParam - 1) * limit;

  const [{ products, total }, hospitals] = await Promise.all([
    getProducts({ search, category, limit, offset }).catch(() => ({ products: [], total: 0 })),
    getHospitals().catch(() => []),
  ]);

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">내 품목</h1>
        <p className="text-sm text-muted-foreground mt-1">
          주문에서 선택한 품목을 관리합니다.
        </p>
      </div>
      <ProductSearch search={search} category={category} />
      <ProductTable
        products={products}
        hospitals={hospitals}
        total={total}
        page={pageParam}
        pageSize={limit}
      />
      <RealtimeListener table="products" />
    </>
  );
}
