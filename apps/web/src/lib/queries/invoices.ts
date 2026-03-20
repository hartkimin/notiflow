import { createClient } from "@/lib/supabase/server";
import type { TaxInvoice, TaxInvoiceDetail, TaxInvoiceStats, UnbilledOrder } from "@/lib/tax-invoice/types";

export async function getInvoices(params: {
  status?: string;
  hospital_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ invoices: TaxInvoice[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("tax_invoices")
    .select("*", { count: "exact" });

  if (params.status) query = query.eq("status", params.status);
  if (params.hospital_id) query = query.eq("hospital_id", params.hospital_id);
  if (params.from) query = query.gte("issue_date", params.from);
  if (params.to) query = query.lte("issue_date", params.to);

  query = query
    .order("created_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 25) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { invoices: (data ?? []) as TaxInvoice[], total: count ?? 0 };
}

export async function getInvoice(id: number): Promise<TaxInvoiceDetail> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("tax_invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items } = await supabase
    .from("tax_invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("item_seq");

  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id, amount, orders(order_number)")
    .eq("invoice_id", id);

  return {
    ...invoice,
    items: items ?? [],
    linked_orders: (linkedOrders ?? []).map((lo) => ({
      order_id: lo.order_id,
      order_number: (lo.orders as unknown as { order_number: string } | null)?.order_number ?? "",
      amount: lo.amount,
    })),
  } as TaxInvoiceDetail;
}

export async function getInvoiceStats(params: {
  from?: string;
  to?: string;
} = {}): Promise<TaxInvoiceStats> {
  const supabase = await createClient();

  let query = supabase.from("tax_invoices").select("status, supply_amount, tax_amount, total_amount");
  if (params.from) query = query.gte("issue_date", params.from);
  if (params.to) query = query.lte("issue_date", params.to);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const activeRows = rows.filter((r) => r.status === "issued" || r.status === "sent");
  const draftRows = rows.filter((r) => r.status === "draft");
  const cancelledRows = rows.filter((r) => r.status === "cancelled");

  const sumAmount = (arr: typeof rows) => arr.reduce((s, r) => s + Number(r.total_amount), 0);

  const { count: unbilledCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "delivered");

  return {
    total_count: rows.length,
    issued_count: activeRows.length,
    draft_count: draftRows.length,
    cancelled_count: cancelledRows.length,
    total_supply_amount: activeRows.reduce((s, r) => s + Number(r.supply_amount), 0),
    total_tax_amount: activeRows.reduce((s, r) => s + Number(r.tax_amount), 0),
    total_amount: activeRows.reduce((s, r) => s + Number(r.total_amount), 0),
    unbilled_order_count: unbilledCount ?? 0,
    by_status: {
      all: { count: rows.length, total_amount: sumAmount(rows) },
      draft: { count: draftRows.length, total_amount: sumAmount(draftRows) },
      issued: { count: activeRows.length, total_amount: sumAmount(activeRows) },
      cancelled: { count: cancelledRows.length, total_amount: sumAmount(cancelledRows) },
    },
  };
}

export async function getUnbilledOrders(hospitalId?: number): Promise<UnbilledOrder[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, order_number, order_date, hospital_id, status, total_amount, supply_amount, tax_amount, delivery_date, delivered_at, hospitals(name), order_items(id, product_name, quantity, unit_price, purchase_price, line_total, sales_rep)")
    .eq("status", "delivered")
    .order("order_date", { ascending: false });

  if (hospitalId) query = query.eq("hospital_id", hospitalId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    hospital_name: (row.hospitals as unknown as { name: string } | null)?.name,
    hospitals: undefined,
    items: (row.order_items ?? []) as UnbilledOrder["items"],
    order_items: undefined,
  })) as UnbilledOrder[];
}

/** Get invoices with items for a date range (calendar view) */
export async function getInvoicesForCalendar(params: {
  from: string;
  to: string;
}): Promise<TaxInvoiceDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_invoices")
    .select("*, tax_invoice_items(*), tax_invoice_orders(order_id, amount, orders(order_number))")
    .gte("issue_date", params.from)
    .lt("issue_date", params.to)
    .order("issue_date", { ascending: false })
    .limit(500);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    items: (row.tax_invoice_items ?? []),
    tax_invoice_items: undefined,
    linked_orders: (row.tax_invoice_orders ?? []).map((lo: Record<string, unknown>) => ({
      order_id: lo.order_id,
      order_number: (lo.orders as unknown as { order_number: string } | null)?.order_number ?? "",
      amount: lo.amount,
    })),
    tax_invoice_orders: undefined,
  })) as TaxInvoiceDetail[];
}

/** Get the most recent invoice issue_date */
export async function getLatestInvoiceDate(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_invoices")
    .select("issue_date")
    .order("issue_date", { ascending: false })
    .limit(1)
    .single();
  return data?.issue_date ?? null;
}

export async function getInvoicesForOrder(orderId: number): Promise<TaxInvoice[]> {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("tax_invoice_orders")
    .select("invoice_id")
    .eq("order_id", orderId);

  if (!links?.length) return [];

  const invoiceIds = links.map((l) => l.invoice_id);
  const { data, error } = await supabase
    .from("tax_invoices")
    .select("*")
    .in("id", invoiceIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []) as TaxInvoice[];
}
