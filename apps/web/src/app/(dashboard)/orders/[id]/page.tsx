import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getOrder } from "@/lib/queries/orders";
import { getProductsCatalog } from "@/lib/queries/products";
import { getSuppliers } from "@/lib/queries/suppliers";
import { getOrderComments } from "@/lib/actions";
import { getInvoicesForOrder } from "@/lib/queries/invoices";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RealtimeListener } from "@/components/realtime-listener";
import { OrderDetailClient } from "@/components/order-detail-client";
import { PrintButton } from "@/components/print-button";
import { ORDER_STATUS_LABELS as STATUS_LABELS } from "@/lib/order-status";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const orderId = Number(id);
  if (isNaN(orderId)) notFound();

  let order;
  let products;
  let supplierOptions;
  let comments;
  let linkedInvoices;
  try {
    const [orderData, prodData, suppData, commentsData, invoicesData] = await Promise.all([
      getOrder(orderId),
      getProductsCatalog(),
      getSuppliers({ limit: 500 }),
      getOrderComments(orderId),
      getInvoicesForOrder(orderId),
    ]);
    order = orderData;
    // products_catalog VIEW returns a subset of Product fields; cast for backward compat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products = prodData as any;
    supplierOptions = suppData.suppliers.map((s) => ({ id: s.id, name: s.name }));
    comments = commentsData;
    linkedInvoices = invoicesData;
  } catch {
    notFound();
  }

  return (
    <>
      <RealtimeListener tables={["orders", "order_items"]} />

      {/* Header - hidden on print */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" className="shrink-0" asChild>
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold md:text-2xl truncate">
              {order.order_number}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <PrintButton />
        </div>
      </div>

      {/* Print header - visible only on print */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold text-center mb-2">주문서</h1>
        <div className="flex justify-between text-sm">
          <div>
            <p><strong>주문번호:</strong> {order.order_number}</p>
            <p><strong>주문일:</strong> {order.order_date}</p>
            <p><strong>거래처:</strong> {order.hospital_name}</p>
          </div>
          <div className="text-right">
            <p><strong>상태:</strong> {STATUS_LABELS[order.status]}</p>
            {order.delivery_date && (
              <p><strong>배송예정:</strong> {order.delivery_date}</p>
            )}
            {order.delivered_at && (
              <p><strong>실제배송:</strong> {new Date(order.delivered_at).toLocaleDateString("ko-KR")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order info + items in single card */}
      <Card className="print:border print:shadow-none">
        <CardHeader className="pb-3 print:hidden">
          <CardTitle className="text-base">주문 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderDetailClient order={order} products={products} suppliers={supplierOptions} comments={comments} linkedInvoices={linkedInvoices} />
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">비고</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
