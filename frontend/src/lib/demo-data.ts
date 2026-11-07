// Demo data for static screens. Step 3 mein yeh FastAPI APIs se replace hoga.

export type Role = "admin" | "manager" | "salesperson";

export interface Category {
  id: number;
  name: string;
  parent?: string;
  productCount: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  rating: string;
  purchasePrice: number;
  sellingPrice: number;
  minPrice: number;
  stock: number;
  reorderLevel: number;
  hasDatasheet: boolean;
}

export interface StockMovement {
  id: number;
  date: string;
  sku: string;
  product: string;
  type: "IN" | "OUT" | "ADJUST";
  qty: number;
  reference: string;
  user: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  city: string;
  type: "Retail" | "Dealer" | "Installer";
  totalPurchases: number;
  lastContact: string;
  optOut: boolean;
}

export type QuotationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "rejected";

export interface Quotation {
  id: string;
  customer: string;
  date: string;
  items: number;
  total: number;
  discountPct: number;
  status: QuotationStatus;
  createdBy: string;
}

export interface Conversation {
  id: number;
  customer: string;
  channel: "voice" | "whatsapp" | "web";
  language: "Urdu" | "English" | "Punjabi";
  summary: string;
  outcome: "quotation" | "info" | "handoff" | "no_stock";
  duration: string;
  time: string;
}

export interface ChatMessage {
  from: "customer" | "ai" | "staff";
  text: string;
  time: string;
}

export interface WhatsAppThread {
  id: number;
  customer: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  assignedTo: string;
  windowOpen: boolean;
  messages: ChatMessage[];
}

export interface Followup {
  id: number;
  customer: string;
  quotation: string;
  dueDate: string;
  channel: "whatsapp" | "call";
  status: "pending" | "completed" | "cancelled";
  note: string;
}

export interface KnowledgeDoc {
  id: number;
  title: string;
  type: "Manual" | "Datasheet" | "FAQ";
  product: string;
  pages: number;
  status: "approved" | "processing" | "pending_review";
  uploaded: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLogin: string;
}

export const categories: Category[] = [
  { id: 1, name: "Solar Inverters", productCount: 4 },
  { id: 2, name: "Hybrid Inverters", parent: "Solar Inverters", productCount: 2 },
  { id: 3, name: "VFDs", productCount: 3 },
  { id: 4, name: "Batteries", productCount: 3 },
  { id: 5, name: "Lithium Batteries", parent: "Batteries", productCount: 2 },
  { id: 6, name: "Cables", productCount: 3 },
  { id: 7, name: "Electrical Accessories", productCount: 4 },
];

export const products: Product[] = [
  { id: 1, sku: "INV-HYB-6K", name: "Hybrid Inverter 6kW", brand: "Growatt", category: "Hybrid Inverters", rating: "6kW, 48V", purchasePrice: 198000, sellingPrice: 228000, minPrice: 215000, stock: 14, reorderLevel: 5, hasDatasheet: true },
  { id: 2, sku: "INV-HYB-10K", name: "Hybrid Inverter 10kW", brand: "Inverex", category: "Hybrid Inverters", rating: "10kW, 48V", purchasePrice: 345000, sellingPrice: 392000, minPrice: 370000, stock: 3, reorderLevel: 4, hasDatasheet: true },
  { id: 3, sku: "INV-ONG-15K", name: "On-Grid Inverter 15kW", brand: "Huawei", category: "Solar Inverters", rating: "15kW, 3-phase", purchasePrice: 410000, sellingPrice: 465000, minPrice: 440000, stock: 6, reorderLevel: 2, hasDatasheet: true },
  { id: 4, sku: "VFD-7.5-3P", name: "VFD 7.5kW (3-phase in)", brand: "INVT", category: "VFDs", rating: "7.5kW / 10HP, 380V", purchasePrice: 88000, sellingPrice: 104000, minPrice: 97000, stock: 9, reorderLevel: 3, hasDatasheet: true },
  { id: 5, sku: "VFD-2.2-1P", name: "VFD 2.2kW (1-phase in, 3-phase out)", brand: "Delta", category: "VFDs", rating: "2.2kW / 3HP, 220V", purchasePrice: 36000, sellingPrice: 43500, minPrice: 40000, stock: 0, reorderLevel: 3, hasDatasheet: false },
  { id: 6, sku: "VFD-SOL-15", name: "Solar Pump VFD 15kW", brand: "INVT", category: "VFDs", rating: "15kW / 20HP, DC/AC", purchasePrice: 152000, sellingPrice: 178000, minPrice: 168000, stock: 4, reorderLevel: 2, hasDatasheet: true },
  { id: 7, sku: "BAT-LI-5K", name: "Lithium Battery 5.12kWh", brand: "Pylontech", category: "Lithium Batteries", rating: "51.2V 100Ah", purchasePrice: 255000, sellingPrice: 289000, minPrice: 275000, stock: 11, reorderLevel: 4, hasDatasheet: true },
  { id: 8, sku: "BAT-TUB-200", name: "Tubular Battery 200Ah", brand: "Phoenix", category: "Batteries", rating: "12V 200Ah", purchasePrice: 58000, sellingPrice: 66500, minPrice: 63000, stock: 22, reorderLevel: 8, hasDatasheet: false },
  { id: 9, sku: "CAB-DC-6", name: "Solar DC Cable 6mm²", brand: "Fast Cables", category: "Cables", rating: "6mm², 100m roll", purchasePrice: 31000, sellingPrice: 36500, minPrice: 34500, stock: 40, reorderLevel: 10, hasDatasheet: true },
  { id: 10, sku: "CAB-AC-4C10", name: "Copper Cable 4-core 10mm²", brand: "Pakistan Cables", category: "Cables", rating: "10mm², per meter", purchasePrice: 1450, sellingPrice: 1720, minPrice: 1640, stock: 650, reorderLevel: 200, hasDatasheet: false },
  { id: 11, sku: "ACC-MCB-32", name: "DC MCB 32A 2-pole", brand: "Tomzn", category: "Electrical Accessories", rating: "32A, 550V DC", purchasePrice: 1150, sellingPrice: 1500, minPrice: 1350, stock: 6, reorderLevel: 25, hasDatasheet: false },
  { id: 12, sku: "ACC-SPD-DC", name: "DC Surge Protector", brand: "Tomzn", category: "Electrical Accessories", rating: "1000V DC, 40kA", purchasePrice: 2300, sellingPrice: 2950, minPrice: 2700, stock: 34, reorderLevel: 15, hasDatasheet: true },
];

export const stockMovements: StockMovement[] = [
  { id: 1, date: "2026-10-28 16:40", sku: "INV-HYB-10K", product: "Hybrid Inverter 10kW", type: "OUT", qty: -2, reference: "SALE-1042", user: "Ali Raza" },
  { id: 2, date: "2026-10-28 11:15", sku: "BAT-LI-5K", product: "Lithium Battery 5.12kWh", type: "IN", qty: 8, reference: "PO-311", user: "Admin" },
  { id: 3, date: "2026-10-27 17:05", sku: "ACC-MCB-32", product: "DC MCB 32A 2-pole", type: "OUT", qty: -30, reference: "SALE-1039", user: "Usman Tariq" },
  { id: 4, date: "2026-10-27 10:20", sku: "VFD-2.2-1P", product: "VFD 2.2kW (1-phase in, 3-phase out)", type: "OUT", qty: -1, reference: "SALE-1037", user: "Ali Raza" },
  { id: 5, date: "2026-10-26 13:00", sku: "CAB-AC-4C10", product: "Copper Cable 4-core 10mm²", type: "ADJUST", qty: -5, reference: "Damaged roll end", user: "Manager" },
  { id: 6, date: "2026-10-25 15:30", sku: "VFD-7.5-3P", product: "VFD 7.5kW (3-phase in)", type: "IN", qty: 5, reference: "PO-309", user: "Admin" },
];

export const customers: Customer[] = [
  { id: 1, name: "Bilal Solar Solutions", phone: "+92 300 1234567", city: "Lahore", type: "Installer", totalPurchases: 2450000, lastContact: "2026-10-28", optOut: false },
  { id: 2, name: "Haji Rashid Farms", phone: "+92 301 7654321", city: "Okara", type: "Retail", totalPurchases: 356000, lastContact: "2026-10-27", optOut: false },
  { id: 3, name: "Al-Noor Electric Store", phone: "+92 321 5558899", city: "Faisalabad", type: "Dealer", totalPurchases: 5120000, lastContact: "2026-10-26", optOut: false },
  { id: 4, name: "Sana Textile Mills", phone: "+92 333 4441122", city: "Kasur", type: "Retail", totalPurchases: 1280000, lastContact: "2026-10-22", optOut: false },
  { id: 5, name: "Green Power Installers", phone: "+92 345 9990011", city: "Gujranwala", type: "Installer", totalPurchases: 890000, lastContact: "2026-10-18", optOut: true },
  { id: 6, name: "Muhammad Akram", phone: "+92 302 3216540", city: "Sahiwal", type: "Retail", totalPurchases: 66500, lastContact: "2026-10-28", optOut: false },
];

export const quotations: Quotation[] = [
  { id: "QT-2026-0158", customer: "Haji Rashid Farms", date: "2026-10-28", items: 3, total: 412500, discountPct: 2, status: "sent", createdBy: "AI Agent" },
  { id: "QT-2026-0157", customer: "Bilal Solar Solutions", date: "2026-10-28", items: 6, total: 1865000, discountPct: 7, status: "pending_approval", createdBy: "Ali Raza" },
  { id: "QT-2026-0156", customer: "Muhammad Akram", date: "2026-10-27", items: 1, total: 66500, discountPct: 0, status: "accepted", createdBy: "AI Agent" },
  { id: "QT-2026-0155", customer: "Al-Noor Electric Store", date: "2026-10-26", items: 12, total: 3240000, discountPct: 4, status: "approved", createdBy: "Usman Tariq" },
  { id: "QT-2026-0154", customer: "Sana Textile Mills", date: "2026-10-24", items: 4, total: 958000, discountPct: 3, status: "sent", createdBy: "AI Agent" },
  { id: "QT-2026-0153", customer: "Green Power Installers", date: "2026-10-20", items: 2, total: 211000, discountPct: 0, status: "rejected", createdBy: "Ali Raza" },
  { id: "QT-2026-0152", customer: "Bilal Solar Solutions", date: "2026-10-19", items: 2, total: 578000, discountPct: 0, status: "draft", createdBy: "Usman Tariq" },
];

export const conversations: Conversation[] = [
  { id: 1, customer: "Haji Rashid Farms", channel: "whatsapp", language: "Urdu", summary: "Solar pump VFD for a 15kW tube well. Motor rating confirmed, quotation sent.", outcome: "quotation", duration: "12 msgs", time: "2026-10-28 14:22" },
  { id: 2, customer: "Muhammad Akram", channel: "voice", language: "Punjabi", summary: "Asked for price and stock of the 200Ah tubular battery.", outcome: "quotation", duration: "3m 40s", time: "2026-10-28 12:05" },
  { id: 3, customer: "Unknown (+92 312 ...)", channel: "voice", language: "Urdu", summary: "Wanted to run a 5HP motor on single-phase supply. Handed off to a technician for safety.", outcome: "handoff", duration: "5m 12s", time: "2026-10-28 10:48" },
  { id: 4, customer: "Bilal Solar Solutions", channel: "web", language: "English", summary: "Bulk inquiry for 10kW hybrid inverters; asked for 7% discount, approval request created.", outcome: "quotation", duration: "18 msgs", time: "2026-10-28 09:30" },
  { id: 5, customer: "Sana Textile Mills", channel: "whatsapp", language: "English", summary: "VFD 2.2kW single-phase inquiry. Out of stock, restock date shared.", outcome: "no_stock", duration: "7 msgs", time: "2026-10-27 16:10" },
  { id: 6, customer: "Al-Noor Electric Store", channel: "whatsapp", language: "Urdu", summary: "Technical question about the DC SPD voltage rating.", outcome: "info", duration: "5 msgs", time: "2026-10-27 11:42" },
];

export const whatsappThreads: WhatsAppThread[] = [
  {
    id: 1, customer: "Haji Rashid Farms", phone: "+92 301 7654321", lastMessage: "Quotation PDF sent.", time: "14:25", unread: 0, assignedTo: "AI Agent", windowOpen: true,
    messages: [
      { from: "customer", text: "Assalam o alaikum, tube well ke liye solar VFD chahiye. Motor 20HP hai.", time: "14:10" },
      { from: "ai", text: "Walaikum assalam! 20HP (15kW) motor ke liye INVT Solar Pump VFD 15kW available hai. Kya motor 3-phase 380V hai, aur aap ke paas kitne kW ke solar panels hain?", time: "14:11" },
      { from: "customer", text: "Ji 3 phase hai, panels 22kW lagane hain.", time: "14:15" },
      { from: "ai", text: "Theek hai. VFD 15kW ki price Rs 178,000 hai aur stock mein 4 units hain. Kya main DC cable aur surge protector ke saath quotation bana doon?", time: "14:16" },
      { from: "customer", text: "Haan bana dein.", time: "14:20" },
      { from: "ai", text: "Quotation QT-2026-0158 tayyar hai (Rs 412,500). PDF bhej di gayi hai.", time: "14:25" },
    ],
  },
  {
    id: 2, customer: "Al-Noor Electric Store", phone: "+92 321 5558899", lastMessage: "10 pieces DC MCB available hain?", time: "13:02", unread: 2, assignedTo: "Usman Tariq", windowOpen: true,
    messages: [
      { from: "customer", text: "DC MCB 32A ka rate kya hai?", time: "12:58" },
      { from: "ai", text: "DC MCB 32A 2-pole (Tomzn) Rs 1,500 per piece hai.", time: "12:59" },
      { from: "customer", text: "10 pieces DC MCB available hain?", time: "13:02" },
    ],
  },
  {
    id: 3, customer: "Sana Textile Mills", phone: "+92 333 4441122", lastMessage: "Follow-up: kya aap ne quotation dekh li?", time: "Kal", unread: 0, assignedTo: "AI Agent", windowOpen: false,
    messages: [
      { from: "ai", text: "[Template] Follow-up: kya aap ne quotation QT-2026-0154 dekh li? Koi sawal ho to reply karein.", time: "Kal 10:00" },
    ],
  },
];

export const followups: Followup[] = [
  { id: 1, customer: "Sana Textile Mills", quotation: "QT-2026-0154", dueDate: "2026-10-28", channel: "whatsapp", status: "pending", note: "Day 4: no reply yet" },
  { id: 2, customer: "Haji Rashid Farms", quotation: "QT-2026-0158", dueDate: "2026-11-01", channel: "whatsapp", status: "pending", note: "Scheduled from day 0" },
  { id: 3, customer: "Bilal Solar Solutions", quotation: "QT-2026-0157", dueDate: "2026-10-31", channel: "call", status: "pending", note: "Call after approval" },
  { id: 4, customer: "Muhammad Akram", quotation: "QT-2026-0156", dueDate: "2026-10-30", channel: "whatsapp", status: "cancelled", note: "Order confirmed, auto-cancelled" },
  { id: 5, customer: "Green Power Installers", quotation: "QT-2026-0153", dueDate: "2026-10-24", channel: "whatsapp", status: "cancelled", note: "Customer opted out" },
  { id: 6, customer: "Al-Noor Electric Store", quotation: "QT-2026-0155", dueDate: "2026-10-27", channel: "call", status: "completed", note: "Delivery date confirmed" },
];

export const knowledgeDocs: KnowledgeDoc[] = [
  { id: 1, title: "INVT GD100-PV Solar Pump Inverter Manual", type: "Manual", product: "VFD-SOL-15", pages: 86, status: "approved", uploaded: "2026-10-12" },
  { id: 2, title: "Growatt SPF 6000 ES Plus Datasheet", type: "Datasheet", product: "INV-HYB-6K", pages: 2, status: "approved", uploaded: "2026-10-10" },
  { id: 3, title: "Pylontech US5000 Datasheet", type: "Datasheet", product: "BAT-LI-5K", pages: 2, status: "approved", uploaded: "2026-10-10" },
  { id: 4, title: "VFD selection FAQ (single vs three phase)", type: "FAQ", product: "VFDs", pages: 4, status: "pending_review", uploaded: "2026-10-26" },
  { id: 5, title: "Huawei SUN2000-15KTL Manual", type: "Manual", product: "INV-ONG-15K", pages: 120, status: "processing", uploaded: "2026-10-28" },
];

export const users: User[] = [
  { id: 1, name: "Admin", email: "admin@solarstore.pk", role: "admin", active: true, lastLogin: "2026-10-29 09:02" },
  { id: 2, name: "Kamran Shah", email: "kamran@solarstore.pk", role: "manager", active: true, lastLogin: "2026-10-28 18:40" },
  { id: 3, name: "Ali Raza", email: "ali@solarstore.pk", role: "salesperson", active: true, lastLogin: "2026-10-29 08:55" },
  { id: 4, name: "Usman Tariq", email: "usman@solarstore.pk", role: "salesperson", active: true, lastLogin: "2026-10-28 17:12" },
  { id: 5, name: "Hamza Iqbal", email: "hamza@solarstore.pk", role: "salesperson", active: false, lastLogin: "2026-09-30 12:00" },
];

export const permissionMatrix: { permission: string; admin: boolean; manager: boolean; salesperson: boolean }[] = [
  { permission: "View products & selling price", admin: true, manager: true, salesperson: true },
  { permission: "View purchase cost", admin: true, manager: true, salesperson: false },
  { permission: "Edit products & prices", admin: true, manager: true, salesperson: false },
  { permission: "Stock IN / OUT / Adjust", admin: true, manager: true, salesperson: false },
  { permission: "Create quotations", admin: true, manager: true, salesperson: true },
  { permission: "Approve below-minimum price", admin: true, manager: true, salesperson: false },
  { permission: "View profit reports", admin: true, manager: true, salesperson: false },
  { permission: "Manage users & roles", admin: true, manager: false, salesperson: false },
  { permission: "View audit logs", admin: true, manager: false, salesperson: false },
];

export const monthlySales = [
  { month: "May", sales: 6.2 },
  { month: "Jun", sales: 8.9 },
  { month: "Jul", sales: 7.4 },
  { month: "Aug", sales: 9.8 },
  { month: "Sep", sales: 11.3 },
  { month: "Oct", sales: 12.6 },
];

// ---- Sales, purchases aur accounts ----

export type PaymentMode = "Cash" | "Bank Transfer" | "Cheque" | "Due";
export type PaymentStatus = "paid" | "partial" | "unpaid";

export interface InvoiceRow {
  no: number;
  date: string;
  party: string;
  mode: PaymentMode;
  items: number;
  total: number;
  received: number;
  paymentDays: number;
  taxable: boolean;
}

export const TAX_RATE = 0.18;

export function paymentStatus(total: number, received: number): PaymentStatus {
  if (received >= total) return "paid";
  return received > 0 ? "partial" : "unpaid";
}

export const salesInvoices: InvoiceRow[] = [
  { no: 1046, date: "2026-10-29", party: "Haji Rashid Farms", mode: "Due", items: 3, total: 412500, received: 0, paymentDays: 15, taxable: true },
  { no: 1045, date: "2026-10-29", party: "Walk-in customer", mode: "Cash", items: 2, total: 3000, received: 3000, paymentDays: 0, taxable: false },
  { no: 1044, date: "2026-10-29", party: "Al-Noor Electric Store", mode: "Bank Transfer", items: 12, total: 3240000, received: 2000000, paymentDays: 30, taxable: true },
  { no: 1043, date: "2026-10-28", party: "Muhammad Akram", mode: "Cash", items: 1, total: 66500, received: 66500, paymentDays: 0, taxable: false },
  { no: 1042, date: "2026-10-28", party: "Bilal Solar Solutions", mode: "Due", items: 2, total: 784000, received: 0, paymentDays: 30, taxable: true },
  { no: 1041, date: "2026-10-27", party: "Walk-in customer", mode: "Cash", items: 4, total: 8920, received: 8920, paymentDays: 0, taxable: false },
  { no: 1040, date: "2026-10-27", party: "Sana Textile Mills", mode: "Cheque", items: 5, total: 958000, received: 958000, paymentDays: 0, taxable: true },
  { no: 1039, date: "2026-10-27", party: "Bilal Solar Solutions", mode: "Due", items: 1, total: 45000, received: 20000, paymentDays: 15, taxable: true },
  { no: 1038, date: "2026-10-26", party: "Green Power Installers", mode: "Due", items: 6, total: 211000, received: 0, paymentDays: 7, taxable: true },
  { no: 1037, date: "2026-10-26", party: "Walk-in customer", mode: "Cash", items: 1, total: 43500, received: 43500, paymentDays: 0, taxable: false },
];

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  city: string;
  products: string;
  payable: number;
  lastPurchase: string;
}

export const suppliers: Supplier[] = [
  { id: 1, name: "Growatt Pakistan Distributor", phone: "+92 42 3588 1100", city: "Lahore", products: "Hybrid inverters", payable: 594000, lastPurchase: "2026-10-28" },
  { id: 2, name: "INVT Drives Karachi", phone: "+92 21 3456 7788", city: "Karachi", products: "VFDs, solar pump drives", payable: 0, lastPurchase: "2026-10-25" },
  { id: 3, name: "Pylontech Authorized Dealer", phone: "+92 51 2223 4455", city: "Islamabad", products: "Lithium batteries", payable: 1020000, lastPurchase: "2026-10-28" },
  { id: 4, name: "Fast Cables Wholesale", phone: "+92 42 3712 9090", city: "Lahore", products: "DC/AC cables", payable: 155000, lastPurchase: "2026-10-20" },
  { id: 5, name: "Hall Road Accessories", phone: "+92 300 8889911", city: "Lahore", products: "MCBs, SPDs, connectors", payable: 34500, lastPurchase: "2026-10-22" },
];

export const purchaseInvoices: InvoiceRow[] = [
  { no: 311, date: "2026-10-28", party: "Pylontech Authorized Dealer", mode: "Due", items: 8, total: 2040000, received: 1020000, paymentDays: 30, taxable: true },
  { no: 310, date: "2026-10-28", party: "Growatt Pakistan Distributor", mode: "Due", items: 3, total: 594000, received: 0, paymentDays: 45, taxable: true },
  { no: 309, date: "2026-10-25", party: "INVT Drives Karachi", mode: "Bank Transfer", items: 5, total: 440000, received: 440000, paymentDays: 0, taxable: true },
  { no: 308, date: "2026-10-22", party: "Hall Road Accessories", mode: "Due", items: 40, total: 46000, received: 11500, paymentDays: 15, taxable: false },
  { no: 307, date: "2026-10-20", party: "Fast Cables Wholesale", mode: "Due", items: 5, total: 155000, received: 0, paymentDays: 30, taxable: true },
];

export interface ProformaInvoice {
  no: string;
  date: string;
  customer: string;
  total: number;
  validTill: string;
  status: "open" | "converted" | "expired";
}

export const proformaInvoices: ProformaInvoice[] = [
  { no: "PI-0042", date: "2026-10-28", customer: "Sana Textile Mills", total: 1865000, validTill: "2026-11-04", status: "open" },
  { no: "PI-0041", date: "2026-10-24", customer: "Al-Noor Electric Store", total: 3240000, validTill: "2026-10-31", status: "converted" },
  { no: "PI-0040", date: "2026-10-15", customer: "Haji Rashid Farms", total: 356000, validTill: "2026-10-22", status: "expired" },
];

export interface WalkInSale {
  invoice: number;
  date: string;
  name: string;
  phone: string;
  items: string;
  total: number;
  mode: PaymentMode;
}

export const walkInSales: WalkInSale[] = [
  { invoice: 1045, date: "2026-10-29 17:20", name: "—", phone: "—", items: "DC MCB 32A ×2", total: 3000, mode: "Cash" },
  { invoice: 1041, date: "2026-10-27 15:05", name: "Zeeshan", phone: "+92 311 2223344", items: "DC SPD ×2, MCB ×2", total: 8920, mode: "Cash" },
  { invoice: 1037, date: "2026-10-26 12:40", name: "Arif Electrician", phone: "+92 333 1112233", items: "VFD 2.2kW ×1", total: 43500, mode: "Cash" },
];

export interface ReturnNote {
  no: string;
  date: string;
  party: string;
  againstInvoice: number;
  reason: string;
  amount: number;
  restocked: boolean;
}

export const creditNotes: ReturnNote[] = [
  { no: "CN-0012", date: "2026-10-27", party: "Bilal Solar Solutions", againstInvoice: 1031, reason: "Wrong model (needed 10kW instead of 6kW)", amount: 228000, restocked: true },
  { no: "CN-0011", date: "2026-10-21", party: "Green Power Installers", againstInvoice: 1024, reason: "Damaged in transit", amount: 2950, restocked: false },
];

export const purchaseReturns: ReturnNote[] = [
  { no: "DN-0005", date: "2026-10-23", party: "Hall Road Accessories", againstInvoice: 305, reason: "Faulty MCB batch", amount: 11500, restocked: false },
];

export interface Payment {
  id: number;
  date: string;
  type: "received" | "paid";
  party: string;
  mode: Exclude<PaymentMode, "Due">;
  amount: number;
  reference: string;
}

export const payments: Payment[] = [
  { id: 1, date: "2026-10-29", type: "received", party: "Al-Noor Electric Store", mode: "Bank Transfer", amount: 2000000, reference: "INV-1044" },
  { id: 2, date: "2026-10-28", type: "paid", party: "Pylontech Authorized Dealer", mode: "Bank Transfer", amount: 1020000, reference: "PUR-311" },
  { id: 3, date: "2026-10-27", type: "received", party: "Sana Textile Mills", mode: "Cheque", amount: 958000, reference: "INV-1040" },
  { id: 4, date: "2026-10-27", type: "received", party: "Bilal Solar Solutions", mode: "Cash", amount: 20000, reference: "INV-1039" },
  { id: 5, date: "2026-10-25", type: "paid", party: "INVT Drives Karachi", mode: "Bank Transfer", amount: 440000, reference: "PUR-309" },
];

export interface Expense {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
}

export const expenses: Expense[] = [
  { id: 1, date: "2026-10-29", category: "Transport", description: "Okara delivery (VFD + cables)", amount: 6500, paidBy: "Cash" },
  { id: 2, date: "2026-10-28", category: "Utilities", description: "Shop electricity bill", amount: 38400, paidBy: "Bank" },
  { id: 3, date: "2026-10-25", category: "Salaries", description: "Helper advance", amount: 15000, paidBy: "Cash" },
  { id: 4, date: "2026-10-20", category: "Rent", description: "Shop rent, October", amount: 120000, paidBy: "Bank" },
];

export interface Service {
  id: number;
  code: string;
  name: string;
  unit: string;
  rate: number;
  taxable: boolean;
}

export const services: Service[] = [
  { id: 1, code: "SRV-INST-INV", name: "Inverter installation", unit: "per unit", rate: 8000, taxable: true },
  { id: 2, code: "SRV-INST-VFD", name: "VFD installation & programming", unit: "per unit", rate: 12000, taxable: true },
  { id: 3, code: "SRV-SITE", name: "Site survey (load assessment)", unit: "per visit", rate: 5000, taxable: true },
  { id: 4, code: "SRV-REPAIR", name: "Inverter repair (diagnosis)", unit: "per unit", rate: 3500, taxable: false },
  { id: 5, code: "SRV-DELIV", name: "Delivery within city", unit: "per trip", rate: 2500, taxable: false },
];

export { formatPKR } from "./format";
