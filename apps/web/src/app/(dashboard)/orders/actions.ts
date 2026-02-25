"use server";

import { confirmOrder, updateOrderStatus } from "@/lib/queries/orders";
import { deleteOrders, updateOrder, updateOrderItem, deleteOrderItem } from "@/lib/actions";
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
  data: { quantity?: number; unit_price?: number; product_id?: number },
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

export async function updateOrderHospitalAction(
  orderId: number,
  hospitalId: number,
) {
  await updateOrder(orderId, { hospital_id: hospitalId });
  revalidatePath("/orders");
}
