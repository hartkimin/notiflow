"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateId } from "@/lib/schedule-utils";
import type { ProductAlias } from "@/lib/types";

// --- Products ---

export async function createProduct(data: {
  official_name: string;
  short_name?: string;
  category?: string;
  manufacturer?: string;
  ingredient?: string;
  efficacy?: string;
  standard_code?: string;
  unit?: string;
  unit_price?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ...data,
    name: data.official_name,
  });
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function updateProduct(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

// --- Hospitals ---

export async function createHospital(data: {
  name: string;
  short_name?: string;
  hospital_type?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  business_number?: string;
  payment_terms?: string;
  lead_time_days?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").insert(data);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function updateHospital(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function deleteHospital(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

// --- Product Aliases ---

export async function getProductAliases(productId: number): Promise<ProductAlias[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_aliases")
    .select("*")
    .eq("product_id", productId)
    .order("id");
  if (error) throw error;
  return (data ?? []) as ProductAlias[];
}

export async function createProductAlias(productId: number, data: {
  alias: string;
  hospital_id?: number | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_aliases")
    .insert({ product_id: productId, ...data });
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function updateProductAlias(_productId: number, aliasId: number, data: {
  alias?: string;
  hospital_id?: number | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_aliases")
    .update(data)
    .eq("id", aliasId);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProductAlias(_productId: number, aliasId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_aliases")
    .delete()
    .eq("id", aliasId);
  if (error) throw error;
  revalidatePath("/products");
  return { success: true };
}

// --- Orders ---

export async function deleteOrder(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateOrder(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true };
}

// --- Messages ---

export async function createMessage(data: {
  source_app: string;
  sender?: string;
  content: string;
  device_name?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").insert({
    source_app: data.source_app,
    sender: data.sender || null,
    content: data.content,
    device_name: data.device_name || null,
    received_at: new Date().toISOString(),
    parse_status: "pending",
  });
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateMessage(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMessage(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("raw_messages").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath("/dashboard");
  return { success: true };
}

// --- Suppliers ---

export async function createSupplier(data: {
  name: string;
  short_name?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert(data);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function updateSupplier(id: number, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

// --- Mobile Devices ---

export async function updateDevice(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("mobile_devices").update(data).eq("id", id);
  if (error) throw error;
  revalidatePath("/devices");
  return { success: true };
}

export async function requestDeviceSync(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("trigger-sync", {
    body: { device_id: id },
  });
  if (error) {
    return { success: false, error: error.message ?? "동기화 요청 실패", fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  revalidatePath("/devices");
  revalidatePath("/dashboard");
  return data as { success: boolean; fcm_sent: number; fcm_failed: number; realtime_updated: number };
}

export async function requestAllDevicesSync() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("trigger-sync", {
    body: { device_id: "all" },
  });
  if (error) {
    return { success: false, error: error.message ?? "동기화 요청 실패", fcm_sent: 0, fcm_failed: 0, realtime_updated: 0 };
  }
  revalidatePath("/devices");
  revalidatePath("/dashboard");
  return data as { success: boolean; fcm_sent: number; fcm_failed: number; realtime_updated: number };
}

// --- Users (via manage-users Edge Function) ---

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    method: "POST",
    body: data,
  });
  if (error) throw error;
  revalidatePath("/users");
  return result;
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    method: "PATCH",
    body: { id, ...data },
  });
  if (error) throw error;
  revalidatePath("/users");
  return result;
}

export async function deleteUser(id: string) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke("manage-users", {
    method: "DELETE",
    body: { id },
  });
  if (error) throw error;
  revalidatePath("/users");
  return result;
}

// --- Schedule: Plans ---

export async function createPlan(data: {
  category_id: string;
  date: number;
  title: string;
  order_index?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("plans").insert({
    id: generateId(),
    user_id: user.id,
    category_id: data.category_id,
    date: data.date,
    title: data.title,
    is_completed: false,
    order_index: data.order_index ?? 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePlan(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ ...data, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function togglePlanCompletion(id: string, isCompleted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_completed: isCompleted, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_deleted: true, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function linkPlanToMessage(planId: string, messageId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ linked_message_id: messageId, updated_at: Date.now() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePlanOrderNumber(planId: string, orderNumber: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ order_number: orderNumber, updated_at: Date.now() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

// --- Schedule: Day Categories ---

export async function addCategoryToDay(date: number, categoryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("day_categories").insert({
    id: generateId(),
    user_id: user.id,
    date,
    category_id: categoryId,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function removeCategoryFromDay(dayCategoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("day_categories")
    .delete()
    .eq("id", dayCategoryId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

// --- Schedule: Week Operations ---

export async function addAllCategoriesToWeek(weekStartMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("is_deleted", false)
    .eq("is_active", true);

  if (!categories || categories.length === 0) return { success: true };

  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const { data: existing } = await supabase
    .from("day_categories")
    .select("date, category_id")
    .gte("date", weekStartMs)
    .lt("date", weekEndMs);

  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.date}-${e.category_id}`)
  );

  const now = Date.now();
  const toInsert: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 7; i++) {
    const dayMs = weekStartMs + i * 24 * 60 * 60 * 1000;
    for (const cat of categories) {
      if (!existingSet.has(`${dayMs}-${cat.id}`)) {
        toInsert.push({
          id: generateId(),
          user_id: user.id,
          date: dayMs,
          category_id: cat.id,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("day_categories").insert(toInsert);
    if (error) throw error;
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function copyPreviousWeekPlans(targetWeekStartMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const sourceWeekStartMs = targetWeekStartMs - 7 * 24 * 60 * 60 * 1000;
  const sourceWeekEndMs = targetWeekStartMs;
  const now = Date.now();

  // Copy day_categories
  const { data: srcDayCats } = await supabase
    .from("day_categories")
    .select("*")
    .gte("date", sourceWeekStartMs)
    .lt("date", sourceWeekEndMs);

  if (srcDayCats && srcDayCats.length > 0) {
    const dcInsert = srcDayCats.map((dc) => ({
      id: generateId(),
      user_id: user.id,
      date: dc.date + 7 * 24 * 60 * 60 * 1000,
      category_id: dc.category_id,
      created_at: now,
      updated_at: now,
    }));
    await supabase.from("day_categories").upsert(dcInsert, { onConflict: "id" });
  }

  // Copy plans
  const { data: srcPlans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_deleted", false)
    .gte("date", sourceWeekStartMs)
    .lt("date", sourceWeekEndMs);

  if (srcPlans && srcPlans.length > 0) {
    const planInsert = srcPlans.map((p) => ({
      id: generateId(),
      user_id: user.id,
      category_id: p.category_id,
      date: p.date + 7 * 24 * 60 * 60 * 1000,
      title: p.title,
      is_completed: false,
      linked_message_id: null,
      order_number: null,
      order_index: p.order_index,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    }));
    await supabase.from("plans").insert(planInsert);
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function copyCurrentWeekToNext(sourceWeekStartMs: number) {
  const targetWeekStartMs = sourceWeekStartMs + 7 * 24 * 60 * 60 * 1000;
  return copyPreviousWeekPlans(targetWeekStartMs);
}
