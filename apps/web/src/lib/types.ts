export interface Hospital {
  id: number;
  name: string;
  short_name: string | null;
  hospital_type: string;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  business_number: string | null;
  payment_terms: string | null;
  lead_time_days: number;
  is_active: boolean;
}

export interface Order {
  id: number;
  order_number: string;
  order_date: string;
  hospital_id: number;
  hospital_name?: string;
  status: 'draft' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
  total_items: number;
  total_amount: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  delivery_date: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  notes: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  supplier_id: number | null;
  original_text: string | null;
  quantity: number;
  unit_type: string;
  unit_price: number | null;
  line_total: number | null;
  match_status: string;
  match_confidence: number | null;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface DailyStats {
  date: string;
  total_messages: number;
  parse_success: number;
  orders_created: number;
  parse_success_rate: number;
}

export interface Delivery extends Order {}

export interface KpisReport {
  id: number;
  order_item_id: number;
  report_status: 'pending' | 'reported' | 'confirmed';
  reported_at: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface SalesRow {
  order_number: string;
  hospital_name: string;
  business_number: string;
  address: string;
  product_name: string;
  standard_code: string;
  supplier_name: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
}

export interface Product {
  id: number;
  name: string;
  official_name: string;
  short_name: string | null;
  category: string;
  manufacturer: string | null;
  ingredient: string | null;
  efficacy: string | null;
  standard_code: string | null;
  unit: string | null;
  unit_price: number | null;
  is_active: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  short_name: string | null;
  contact_info: Record<string, unknown> | null;
  notes: string | null;
  is_active: boolean;
}

export interface ProductSupplier {
  id: number;
  product_id: number;
  supplier_id: number;
  purchase_price: number | null;
  is_primary: boolean;
}

export interface ProductAlias {
  id: number;
  hospital_id: number | null;
  alias: string;
  product_id: number;
  source: string;
}

export interface RawMessage {
  id: number;
  source_app: string;
  sender: string | null;
  content: string;
  received_at: string;
  device_id: string | null;
  hospital_id: number | null;
  parse_status: string;
  parse_method: string | null;
  parse_result: Record<string, unknown> | null;
  order_id: number | null;
  is_order_message: boolean | null;
  synced_at: string;
}

export interface CalendarDay {
  date: string;
  message_count: number;
  order_count: number;
  total_amount: number;
}

export interface DashboardUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesReport {
  period: string;
  rows: SalesRow[];
  summary: {
    total_orders: number;
    total_items: number;
    total_supply: number;
    total_tax: number;
    total_amount: number;
  };
}
