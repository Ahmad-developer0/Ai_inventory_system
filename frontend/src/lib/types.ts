// Database rows (supabase/migrations ke mutabiq)

export type Role = "admin" | "manager" | "salesperson" | "agent"; // agent = AI assistant account (migration 0008)
export type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "Due";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type QuotationStatus = "draft" | "pending_approval" | "approved" | "sent" | "accepted" | "rejected";
export type StockStatus = "ok" | "low" | "out";

export const PAYMENT_MODES: PaymentMode[] = ["Cash", "Bank Transfer", "Cheque", "Due"];
export const TAX_RATE = 0.18; // supabase tax_rate() ke barabar rakhein

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

// product_catalog view: purchase_price nahi hai
export interface CatalogProduct {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  category_id: number | null;
  category_name: string | null;
  specifications: string | null;
  selling_price: number;
  min_price: number;
  stock: number;
  reorder_level: number;
  image_path: string | null;
  datasheet_path: string | null;
  active: boolean;
  stock_status: StockStatus;
  unit: string;
  images?: string[]; // storage paths in order, first is the cover (migration 0006)
}

// Manager ke liye poori product row
export interface Product extends CatalogProduct {
  purchase_price: number | null;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  type: "IN" | "OUT" | "ADJUST";
  qty: number;
  reference: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  city: string | null;
  type: "Shopkeeper" | "Retail" | "Dealer" | "Installer";
  notes: string | null;
  shop_name?: string | null;
  opt_out: boolean;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name?: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
}

// sales_view aur purchases_view dono ki common shape
export interface InvoiceViewRow {
  id: number;
  party_name: string;
  payment_mode: PaymentMode;
  payment_days: number;
  subtotal: number;
  tax: number;
  total: number;
  item_count: number;
  pending: number;
  payment_status: PaymentStatus;
  due_date: string;
}

export interface SaleViewRow extends InvoiceViewRow {
  sale_date: string;
  customer_id: number | null;
  walk_in_name: string | null;
  walk_in_phone: string | null;
  supplier_id: number | null;
  party_phone: string | null;
  buyer_type: "customer" | "shopkeeper" | "supplier" | "walk_in";
  less_amount?: number; // migration 0007
  amount_received: number;
}

export interface PurchaseViewRow extends InvoiceViewRow {
  purchase_date: string;
  bill_no: string | null;
  supplier_id: number;
  amount_paid: number;
}

export interface QuotationViewRow {
  id: number;
  quote_no: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  quote_date: string;
  valid_until: string;
  status: QuotationStatus;
  subtotal: number;
  tax: number;
  total: number;
  needs_approval: boolean;
  notes: string | null;
  item_count: number;
  created_by_name: string | null;
}

export interface PaymentViewRow {
  id: number;
  payment_date: string;
  direction: "received" | "paid";
  sale_id: number | null;
  purchase_id: number | null;
  mode: PaymentMode;
  amount: number;
  reference: string | null;
  party_name: string;
}

export interface DashboardStats {
  sales_this_month: number;
  sales_last_month: number;
  sales_today: number;
  open_quotations: number;
  pending_approvals: number;
  receivables: number;
  payables: number | null;
  low_stock: number;
  out_of_stock: number;
  monthly: { month: string; total: number }[];
}

// InvoiceTable ki common row shape
export interface InvoiceRow {
  no: number;
  date: string;
  party: string;
  mode: string;
  items: number;
  total: number;
  received: number;
  pending: number;
  paymentDays: number;
  dueDate: string;
  status: PaymentStatus;
  tax: number;
}

// Supabase numeric columns string ban kar aa sakte hain; is liye har jagah Number() se parhein.
export const num = (v: unknown) => Number(v ?? 0);
