"use server";

import { confirmOrder, updateOrderStatus } from "@/lib/queries/orders";
import { deleteOrders, updateOrder, updateOrderItem, deleteOrderItem, upsertKpisReport, createOrderComment, deleteOrderComment } from "@/lib/actions";
import { revalidatePath } from "next/cache";

export async function confirmOrderAction(orderId: number) {
  await confirmOrder(orderId);
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function updateOrderStatusAction(orderId: number, status: string) {
  await updateOrderStatus(orderId, status);
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function deleteOrdersAction(ids: number[]) {
  await deleteOrders(ids);
}

export async function updateOrderItemAction(
  itemId: number,
  data: { quantity?: number; unit_price?: number; product_id?: number; supplier_id?: number | null },
) {
  await updateOrderItem(itemId, data);
}

export async function deleteOrderItemAction(itemId: number) {
  await deleteOrderItem(itemId);
  revalidatePath("/orders");
}

export async function updateDeliveryDateAction(
  orderId: number,
  date: string | null,
) {
  await updateOrder(orderId, { delivery_date: date });
}

export async function updateDeliveredAtAction(
  orderId: number,
  date: string | null,
) {
  await updateOrder(orderId, { delivered_at: date });
}

export async function updateOrderHospitalAction(
  orderId: number,
  hospitalId: number,
) {
  await updateOrder(orderId, { hospital_id: hospitalId });
  revalidatePath("/orders");
}

export async function upsertKpisReportAction(
  orderItemId: number,
  data: { report_status?: string; notes?: string },
) {
  await upsertKpisReport(orderItemId, data);
}

export async function createOrderCommentAction(orderId: number, content: string) {
  await createOrderComment(orderId, content);
}

export async function deleteOrderCommentAction(commentId: number, orderId: number) {
  await deleteOrderComment(commentId, orderId);
}
