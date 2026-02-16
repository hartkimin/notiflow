import { PlusCircle } from "lucide-react";

import { getProducts } from "@/lib/queries/products";
import { getHospitals } from "@/lib/queries/hospitals";
import { ProductSearch, ProductTable } from "@/components/product-list";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  searchParams: Promise<{ search?: string; category?: string; page?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  const [result, hospitalsResult] = await Promise.all([
    getProducts({
      search: params.search,
      category: params.category,
      limit,
      offset,
    }).catch(() => ({ products: [], total: 0 })),
    getHospitals({ limit: 200 }).catch(() => ({ hospitals: [], total: 0 })),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">품목 관리</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              품목 추가
            </span>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>품목 목록</CardTitle>
          <CardDescription>
            <ProductSearch />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductTable
            products={result.products}
            hospitals={hospitalsResult.hospitals}
          />
        </CardContent>
        <CardFooter>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={result.total}
          />
        </CardFooter>
      </Card>
    </>
  );
}
