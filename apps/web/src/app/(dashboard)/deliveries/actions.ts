"use server";

import { markDelivered } from "@/lib/queries/deliveries";
import { revalidatePath } from "next/cache";

export async function markDeliveredAction(orderId: number) {
  await markDelivered(orderId);
  revalidatePath("/deliveries");
  revalidatePath("/");
}
