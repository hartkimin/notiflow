import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24 mb-1" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
