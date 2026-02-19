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

export interface OrderItemFlat {
  id: number;
  order_id: number;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  hospital_name: string;
  product_name: string;
  quantity: number;
  unit_type: string;
  box_quantity: number | null;
  supplier_name: string | null;
  kpis_status: string | null;
  kpis_notes: string | null;
  status: string;
  match_status: string;
}

export interface DailyStats {
  date: string;
  total_messages: number;
  parse_success: number;
  orders_created: number;
  parse_success_rate: number;
}

export type Delivery = Order;

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
  device_name: string | null;
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

export interface HospitalStat {
  hospital_id: number;
  hospital_name: string;
  order_count: number;
  item_count: number;
  total_amount: number;
}

export interface ProductStat {
  product_id: number;
  product_name: string;
  category: string;
  order_count: number;
  total_quantity: number;
  total_amount: number;
}

export interface TrendPoint {
  date: string;
  messages: number;
  orders: number;
  total_amount: number;
}

export interface MobileDevice {
  id: string;
  user_id: string;
  user_name?: string;
  device_name: string;
  device_model: string | null;
  app_version: string;
  os_version: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string;
  sync_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Mobile Sync (shared with mobile app) ---

export interface MobileCategory {
  id: string;
  name: string;
  color: number;       // ARGB integer from Android
  order_index: number;
  is_active: boolean;
}

export interface Plan {
  id: string;
  category_id: string | null;
  date: number;           // epoch ms
  title: string;
  is_completed: boolean;
  linked_message_id: string | null;
  order_number: string | null;
  order_index: number;
}

export interface DayCategory {
  id: string;
  date: number;           // epoch ms
  category_id: string;
}

export interface CapturedMessage {
  id: string;
  app_name: string;
  sender: string;
  content: string;
  received_at: number;    // epoch ms
  category_id: string | null;
  status_id: string | null;
  is_archived: boolean;
}
