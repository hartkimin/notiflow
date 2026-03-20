// Tax invoice types — matches DB schema from migrations 00051-00053

export type TaxInvoiceStatus = "draft" | "issued" | "sent" | "cancelled" | "modified";
export type TaxInvoiceType = "normal" | "reverse";
export type TaxInvoiceTaxType = "tax" | "zero_rate" | "exempt";
export type ModifyReason =
  | "return"
  | "price_change"
  | "quantity_change"
  | "duplicate"
  | "seller_info_change"
  | "buyer_info_change"
  | "other";

export interface TaxInvoice {
  id: number;
  invoice_number: string;
  invoice_type: TaxInvoiceType;
  tax_type: TaxInvoiceTaxType;
  status: TaxInvoiceStatus;
  issue_date: string;
  supply_date: string | null;
  supply_date_from: string | null;
  supply_date_to: string | null;

  supplier_id: number | null;
  supplier_biz_no: string;
  supplier_name: string;
  supplier_ceo_name: string | null;
  supplier_address: string | null;
  supplier_biz_type: string | null;
  supplier_biz_item: string | null;
  supplier_email: string | null;

  hospital_id: number | null;
  buyer_biz_no: string;
  buyer_name: string;
  buyer_ceo_name: string | null;
  buyer_address: string | null;
  buyer_biz_type: string | null;
  buyer_biz_item: string | null;
  buyer_email: string | null;

  supply_amount: number;
  tax_amount: number;
  total_amount: number;

  original_invoice_id: number | null;
  modify_reason: ModifyReason | null;
  remarks: string | null;

  pdf_url: string | null;
  issued_at: string | null;
  issued_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxInvoiceItem {
  id: number;
  invoice_id: number;
  item_seq: number;
  order_id: number | null;
  order_item_id: number | null;
  item_date: string | null;
  item_name: string;
  specification: string | null;
  quantity: number;
  unit_price: number;
  purchase_price: number | null;
  supply_amount: number;
  tax_amount: number;
  remark: string | null;
}

export interface TaxInvoiceDetail extends TaxInvoice {
  items: TaxInvoiceItem[];
  linked_orders: {
    order_id: number;
    order_number: string;
    amount: number | null;
  }[];
}

export interface TaxInvoiceStatusAmount {
  count: number;
  total_amount: number;
}

export interface TaxInvoiceStats {
  total_count: number;
  issued_count: number;
  draft_count: number;
  cancelled_count: number;
  total_supply_amount: number;
  total_tax_amount: number;
  total_amount: number;
  unbilled_order_count: number;
  by_status: {
    all: TaxInvoiceStatusAmount;
    draft: TaxInvoiceStatusAmount;
    issued: TaxInvoiceStatusAmount;
    cancelled: TaxInvoiceStatusAmount;
  };
}

/** Order with hospital_name resolved — returned by getUnbilledOrders */
export interface UnbilledOrder {
  id: number;
  order_number: string;
  order_date: string;
  hospital_id: number;
  hospital_name: string | undefined;
  status: string;
  total_amount: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  delivery_date: string | null;
  delivered_at: string | null;
}

export interface CompanySettings {
  id: number;
  biz_no: string;
  company_name: string;
  ceo_name: string | null;
  address: string | null;
  biz_type: string | null;
  biz_item: string | null;
  email: string | null;
  auto_issue_on_delivery: boolean;
  default_tax_type: TaxInvoiceTaxType;
  monthly_consolidation: boolean;
  consolidation_day: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
