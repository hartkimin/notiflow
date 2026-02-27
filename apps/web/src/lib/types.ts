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
  quantity: number;
  unit_type: string;
  unit_price: number | null;
  line_total: number | null;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface OrderComment {
  id: number;
  order_id: number;
  user_id: string | null;
  content: string;
  created_at: string;
}

export interface OrderItemFlat {
  id: number;
  order_id: number;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  hospital_id: number | null;
  hospital_name: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_type: string;
  box_quantity: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  kpis_status: string | null;
  kpis_notes: string | null;
  status: string;
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
  mfds_raw: Record<string, unknown> | null;
  mfds_source_type: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  short_name: string | null;
  contact_info: Record<string, unknown> | null;
  business_number: string | null;
  ceo_name: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  website: string | null;
  business_type: string | null;
  business_category: string | null;
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

// --- My Products (MFDS-aligned) ---

export interface MyDrug {
  id: number;
  item_seq: string | null;
  item_name: string | null;
  item_eng_name: string | null;
  entp_name: string | null;
  entp_no: string | null;
  item_permit_date: string | null;
  cnsgn_manuf: string | null;
  etc_otc_code: string | null;
  chart: string | null;
  bar_code: string | null;
  material_name: string | null;
  ee_doc_id: string | null;
  ud_doc_id: string | null;
  nb_doc_id: string | null;
  storage_method: string | null;
  valid_term: string | null;
  pack_unit: string | null;
  edi_code: string | null;
  permit_kind_name: string | null;
  cancel_date: string | null;
  cancel_name: string | null;
  change_date: string | null;
  atc_code: string | null;
  rare_drug_yn: string | null;
  added_at: string;
  synced_at: string;
  unit_price: number | null;
}

export interface MyDevice {
  id: number;
  udidi_cd: string | null;
  prdlst_nm: string | null;
  mnft_iprt_entp_nm: string | null;
  mdeq_clsf_no: string | null;
  clsf_no_grad_cd: string | null;
  permit_no: string | null;
  prmsn_ymd: string | null;
  foml_info: string | null;
  prdt_nm_info: string | null;
  hmbd_trspt_mdeq_yn: string | null;
  dspsbl_mdeq_yn: string | null;
  trck_mng_trgt_yn: string | null;
  total_dev: string | null;
  cmbnmd_yn: string | null;
  use_before_strlzt_need_yn: string | null;
  sterilization_method_nm: string | null;
  use_purps_cont: string | null;
  strg_cnd_info: string | null;
  circ_cnd_info: string | null;
  rcprslry_trgt_yn: string | null;
  added_at: string;
  synced_at: string;
  unit_price: number | null;
}

export interface SyncDiffEntry {
  column: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface ProductCatalogRow {
  id: number;
  name: string;
  official_name: string;
  short_name: string | null;
  is_active: boolean;
  standard_code: string | null;
  source_type: string;
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

export interface CapturedMessage {
  id: string;
  app_name: string;
  sender: string;
  content: string;
  received_at: number;    // epoch ms
  category_id: string | null;
  status_id: string | null;
  is_archived: boolean;
  source: string;
  room_name: string | null;
  sender_icon: string | null;
  attached_image: string | null;
}

export interface ChatRoom {
  source: string;
  app_name: string;
  room_id: string;
  display_title: string;
  last_message: string;
  last_received_at: number;  // epoch ms
  unread_count: number;
  sender_icon: string | null;
  match_count: number;
}

// --- Order Forecasts ---

export type ForecastStatus = 'pending' | 'matched' | 'partial' | 'missed' | 'cancelled';

export interface OrderForecast {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  forecast_date: string;
  notes: string | null;
  status: ForecastStatus;
  source: 'manual' | 'pattern';
  pattern_id: number | null;
  message_id: number | null;
  matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastItem {
  id: number;
  forecast_id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number | null;
  unit_type: string;
  notes: string | null;
}

export interface OrderForecastDetail extends OrderForecast {
  items: ForecastItem[];
}

export interface OrderPattern {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  name: string | null;
  recurrence: { type: string; days: number[]; interval: number };
  default_items: Array<{ product_id: number; product_name?: string; quantity: number }> | null;
  notes: string | null;
  is_active: boolean;
  last_generated: string | null;
}

// --- MFDS Direct API Search ---

export type MfdsApiSource = "drug" | "device_std";

/** Raw API response item from 의약품 제품 허가정보 (getDrugPrdtPrmsnDtlInq06) */
export interface MfdsDrugItem {
  ITEM_SEQ: string;
  ITEM_NAME: string;
  ITEM_ENG_NAME: string;
  ENTP_NAME: string;
  ENTP_NO: string;
  ITEM_PERMIT_DATE: string;
  CNSGN_MANUF: string;
  ETC_OTC_CODE: string;
  CHART: string;
  BAR_CODE: string;
  MATERIAL_NAME: string;
  EE_DOC_ID: string;
  UD_DOC_ID: string;
  NB_DOC_ID: string;
  STORAGE_METHOD: string;
  VALID_TERM: string;
  PACK_UNIT: string;
  EDI_CODE: string;
  PERMIT_KIND_NAME: string;
  CANCEL_DATE: string;
  CANCEL_NAME: string;
  CHANGE_DATE: string;
  ATC_CODE: string;
  RARE_DRUG_YN: string;
  [key: string]: string;
}

/** Raw API response item from 의료기기 표준코드별 제품정보 (getMdeqStdCdPrdtInfoInq03) */
export interface MfdsDeviceStdItem {
  UDIDI_CD: string;
  PRDLST_NM: string;
  MNFT_IPRT_ENTP_NM: string;
  MDEQ_CLSF_NO: string;
  CLSF_NO_GRAD_CD: string;
  PERMIT_NO: string;
  PRMSN_YMD: string;
  FOML_INFO: string;
  PRDT_NM_INFO: string;
  HMBD_TRSPT_MDEQ_YN: string;
  DSPSBL_MDEQ_YN: string;
  TRCK_MNG_TRGT_YN: string;
  TOTAL_DEV: string;
  CMBNMD_YN: string;
  USE_BEFORE_STRLZT_NEED_YN: string;
  STERILIZATION_METHOD_NM: string;
  USE_PURPS_CONT: string;
  STRG_CND_INFO: string;
  CIRC_CND_INFO: string;
  RCPRSLRY_TRGT_YN: string;
  [key: string]: string;
}

export type MfdsApiItem = MfdsDrugItem | MfdsDeviceStdItem;

export interface MfdsApiSearchResult {
  items: MfdsApiItem[];
  totalCount: number;
  page: number;
}
