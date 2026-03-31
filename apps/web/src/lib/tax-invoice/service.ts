"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { resolveItemSupply } from "./calc";
import type { TaxInvoice } from "./types";
import { validateForIssue } from "./validator";

/**
 * Throws if the order already has a non-cancelled active invoice.
 * Used as a pre-flight guard before issuing a new invoice.
 *
 * Uses a plain join (not !inner) so the query works regardless of RLS;
 * status filtering is done in application code to avoid PostgREST
 * embedded-filter edge cases.
 */
export async function assertOrderNotAlreadyInvoiced(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: number,
): Promise<void> {
  const { data } = await supabase
    .from("tax_invoice_orders")
    .select("invoice_id, tax_invoices(status)")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!data) return;

  const status = (data.tax_invoices as { status: string } | null)?.status;
  if (status && status !== "cancelled") {
    throw new Error("이미 발행된 세금계산서가 있습니다. 기존 계산서를 확인해주세요.");
  }
}

export async function createInvoiceFromOrder(orderId: number, issueDate: string) {
  const supabase = createAdminClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, hospitals(*), order_items(*, products(name, standard_code))")
    .eq("id", orderId)
    .in("status", ["confirmed", "delivered"])
    .single();
  if (orderErr || !order) throw new Error("발행 가능한 주문을 찾을 수 없습니다.");

  await assertOrderNotAlreadyInvoiced(supabase, orderId);

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (!company || !company.biz_no) throw new Error("공급자 정보가 설정되지 않았습니다. 설정 > 자사 정보에서 입력해주세요.");

  const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");

  const hospital = order.hospitals as Record<string, unknown>;

  // Calculate supply/tax/total from order_items — 품목별 합산 방식 (부가세 절사)
  const orderItems = (order.order_items ?? []) as Array<Record<string, unknown>>;
  let supplyAmount = 0;
  let taxAmount = 0;
  for (const item of orderItems) {
    const qty = item.quantity as number;
    const supply = resolveItemSupply({
      line_total: item.line_total as number | null,
      unit_price: item.unit_price as number | null,
      quantity: qty,
    });
    supplyAmount += supply;
    taxAmount += Math.floor(supply * 0.1);
  }
  const totalAmount = supplyAmount + taxAmount;

  const { data: invoice, error: invoiceErr } = await supabase
    .from("tax_invoices")
    .insert({
      invoice_number: invoiceNumber,
      tax_type: company.default_tax_type || "tax",
      status: "issued",
      issued_at: new Date().toISOString(),
      issue_date: issueDate,
      supply_date: order.delivery_date,
      supplier_id: company.supplier_id ?? null,
      supplier_biz_no: company.biz_no,
      supplier_name: company.company_name,
      supplier_ceo_name: company.ceo_name,
      supplier_address: company.address,
      supplier_biz_type: company.biz_type,
      supplier_biz_item: company.biz_item,
      supplier_email: company.email,
      hospital_id: order.hospital_id,
      buyer_biz_no: (hospital.business_number as string) || "",
      buyer_name: (hospital.name as string) || "",
      buyer_ceo_name: hospital.ceo_name as string | null,
      buyer_address: hospital.address as string | null,
      buyer_biz_type: hospital.biz_type as string | null,
      buyer_biz_item: hospital.biz_item as string | null,
      buyer_email: hospital.email as string | null,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    })
    .select()
    .single();
  if (invoiceErr) throw invoiceErr;

  const items = orderItems.map((item, idx) => {
    const supply = resolveItemSupply({
      line_total: item.line_total as number | null,
      unit_price: item.unit_price as number | null,
      quantity: item.quantity as number,
    });
    return {
      invoice_id: invoice.id,
      item_seq: idx + 1,
      order_id: orderId,
      order_item_id: item.id as number,
      item_date: order.delivery_date,
      item_name: (item.product_name as string) || ((item.products as Record<string, unknown>)?.name as string) || "품목",
      specification: (item.products as Record<string, unknown>)?.standard_code as string | null,
      quantity: item.quantity as number,
      unit_price: (item.unit_price as number) || 0,
      purchase_price: (item.purchase_price as number) || null,
      supply_amount: supply,
      tax_amount: Math.floor(supply * 0.1),
    };
  });

  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from("tax_invoice_items").insert(items);
    if (itemsErr) {
      console.error("Failed to insert invoice items:", itemsErr);
      throw new Error(`품목 저장 실패: ${itemsErr.message}`);
    }
  }

  const { error: linkErr } = await supabase.from("tax_invoice_orders").insert({
    invoice_id: invoice.id,
    order_id: orderId,
    amount: order.total_amount,
  });
  if (linkErr) throw linkErr;

  // Transition linked order: delivered → invoiced
  await supabase
    .from("orders")
    .update({ status: "invoiced" })
    .eq("id", orderId)
    .eq("status", "delivered");

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number };
}

export async function createConsolidatedInvoice(
  orderIds: number[],
  issueDate: string
) {
  if (orderIds.length === 0) throw new Error("주문을 선택해주세요.");

  const supabase = createAdminClient();

  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("*, hospitals(*), order_items(*, products(name, standard_code))")
    .in("id", orderIds)
    .in("status", ["confirmed", "delivered"]);
  if (ordersErr || !orders?.length) throw new Error("발행 가능한 주문을 찾을 수 없습니다.");

  const hospitalIds = [...new Set(orders.map((o) => o.hospital_id))];
  if (hospitalIds.length > 1) {
    throw new Error("합산 발행은 같은 공급받는자(병원)의 주문만 가능합니다.");
  }

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (!company || !company.biz_no) throw new Error("공급자 정보가 설정되지 않았습니다.");

  // Pre-flight: verify no order is already linked to an active invoice
  for (const id of orderIds) {
    await assertOrderNotAlreadyInvoiced(supabase, id);
  }

  // Calculate from order_items — 품목별 합산 방식 (부가세 절사)
  const totals = { supply: 0, tax: 0, total: 0 };
  for (const o of orders) {
    const items = (o.order_items ?? []) as Array<Record<string, unknown>>;
    for (const item of items) {
      const supply = resolveItemSupply({
        line_total: item.line_total as number | null,
        unit_price: item.unit_price as number | null,
        quantity: item.quantity as number,
      });
      const tax = Math.floor(supply * 0.1);
      totals.supply += supply;
      totals.tax += tax;
      totals.total += supply + tax;
    }
  }

  const dates = orders.map((o) => o.delivery_date).filter(Boolean).sort();
  const supplyDateFrom = dates[0] || null;
  const supplyDateTo = dates.length > 1 ? dates[dates.length - 1] : null;

  const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
  const hospital = orders[0].hospitals as Record<string, unknown>;

  const { data: invoice, error: invoiceErr } = await supabase
    .from("tax_invoices")
    .insert({
      invoice_number: invoiceNumber,
      tax_type: company.default_tax_type || "tax",
      status: "issued",
      issued_at: new Date().toISOString(),
      issue_date: issueDate,
      supply_date_from: supplyDateFrom,
      supply_date_to: supplyDateTo,
      supplier_id: company.supplier_id ?? null,
      supplier_biz_no: company.biz_no,
      supplier_name: company.company_name,
      supplier_ceo_name: company.ceo_name,
      supplier_address: company.address,
      supplier_biz_type: company.biz_type,
      supplier_biz_item: company.biz_item,
      supplier_email: company.email,
      hospital_id: orders[0].hospital_id,
      buyer_biz_no: (hospital.business_number as string) || "",
      buyer_name: (hospital.name as string) || "",
      buyer_ceo_name: hospital.ceo_name as string | null,
      buyer_address: hospital.address as string | null,
      buyer_biz_type: hospital.biz_type as string | null,
      buyer_biz_item: hospital.biz_item as string | null,
      buyer_email: hospital.email as string | null,
      supply_amount: totals.supply,
      tax_amount: totals.tax,
      total_amount: totals.total,
    })
    .select()
    .single();
  if (invoiceErr) throw invoiceErr;

  let seq = 0;
  for (const order of orders) {
    const orderItems = (order.order_items ?? []) as Array<Record<string, unknown>>;
    const items = orderItems.map((item) => {
      const supply = resolveItemSupply({
        line_total: item.line_total as number | null,
        unit_price: item.unit_price as number | null,
        quantity: item.quantity as number,
      });
      return {
        invoice_id: invoice.id,
        item_seq: ++seq,
        order_id: order.id,
        order_item_id: item.id as number,
        item_date: order.delivery_date,
        item_name: (item.product_name as string) || ((item.products as Record<string, unknown>)?.name as string) || "품목",
        specification: (item.products as Record<string, unknown>)?.standard_code as string | null,
        quantity: item.quantity as number,
        unit_price: (item.unit_price as number) || 0,
        purchase_price: (item.purchase_price as number) || null,
        supply_amount: supply,
        tax_amount: Math.floor(supply * 0.1),
      };
    });
    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from("tax_invoice_items").insert(items);
      if (itemsErr) {
        console.error("Failed to insert consolidated invoice items:", itemsErr);
        throw new Error(`품목 저장 실패: ${itemsErr.message}`);
      }
    }

    const { error: linkErr } = await supabase.from("tax_invoice_orders").insert({
      invoice_id: invoice.id,
      order_id: order.id,
      amount: order.total_amount,
    });
    if (linkErr) throw linkErr;

    // Transition linked order: delivered → invoiced
    await supabase
      .from("orders")
      .update({ status: "invoiced" })
      .eq("id", order.id)
      .eq("status", "delivered");
  }

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number };
}

export async function issueInvoice(invoiceId: number) {
  const supabase = createAdminClient();
  const userClient = await createClient();

  const { data: invoice } = await supabase
    .from("tax_invoices")
    .select("*")
    .eq("id", invoiceId)
    .in("status", ["draft", "cancelled"])
    .single();
  if (!invoice) throw new Error("발행 가능한 세금계산서를 찾을 수 없습니다.");

  const { data: items } = await supabase
    .from("tax_invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId);

  const validation = validateForIssue(invoice as TaxInvoice, items ?? []);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }

  const { data: { user } } = await userClient.auth.getUser();

  const { error } = await supabase
    .from("tax_invoices")
    .update({
      status: "issued",
      issued_at: new Date().toISOString(),
      issued_by: user?.id,
    })
    .eq("id", invoiceId);
  if (error) throw error;

  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id")
    .eq("invoice_id", invoiceId);

  // Transition linked orders: delivered → invoiced
  for (const lo of linkedOrders ?? []) {
    await supabase
      .from("orders")
      .update({ status: "invoiced" })
      .eq("id", lo.order_id)
      .eq("status", "delivered");
  }

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { success: true };
}

export async function cancelInvoice(invoiceId: number, reason: string) {
  const supabase = createAdminClient();
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();

  const { error } = await supabase
    .from("tax_invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id,
      remarks: reason,
    })
    .eq("id", invoiceId);
  if (error) throw error;

  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id")
    .eq("invoice_id", invoiceId);

  for (const lo of linkedOrders ?? []) {
    await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", lo.order_id)
      .eq("status", "invoiced");
  }

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { success: true };
}

export async function deleteInvoice(invoiceId: number) {
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("tax_invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (!invoice || (invoice.status !== "draft" && invoice.status !== "cancelled")) {
    throw new Error("취소 또는 임시 상태의 세금계산서만 삭제할 수 있습니다.");
  }

  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id")
    .eq("invoice_id", invoiceId);

  const { error } = await supabase
    .from("tax_invoices")
    .delete()
    .eq("id", invoiceId);
  if (error) throw error;

  for (const lo of linkedOrders ?? []) {
    await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", lo.order_id)
      .eq("status", "invoiced");
  }

  revalidatePath("/invoices");
  return { success: true };
}
