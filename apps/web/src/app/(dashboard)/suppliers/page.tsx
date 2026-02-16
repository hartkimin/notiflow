import { PlusCircle } from "lucide-react";

import { getSuppliers } from "@/lib/queries/suppliers";
import { SupplierSearch, SupplierTable } from "@/components/supplier-list";
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
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function SuppliersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  const result = await getSuppliers({
    search: params.search,
    limit,
    offset,
  }).catch(() => ({ suppliers: [], total: 0 }));

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">공급사 관리</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              공급사 추가
            </span>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>공급사 목록</CardTitle>
          <CardDescription>
            <SupplierSearch />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierTable suppliers={result.suppliers} />
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
