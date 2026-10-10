// Formatos devolvidos pela API (backend/src/modules/*). Dinheiro chega como texto "12.50".

export interface ApiFlavor {
  id: number;
  name: string;
}

export interface ApiProduct {
  id: number;
  name: string;
  brand: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: number;
  category: string;
  price: string;
  unit: string;
  unitDescription: string | null;
  minQty: number;
  stock: number;
  stars: number;
  flavors: ApiFlavor[];
}

export interface AdminFlavor extends ApiFlavor {
  active: boolean;
}

export interface AdminProduct extends Omit<ApiProduct, "flavors"> {
  cost: string | null;
  active: boolean;
  deletedAt: string | null;
  flavors: AdminFlavor[];
}

export interface ApiCategory {
  id: number;
  name: string;
}

export interface AdminCategory extends ApiCategory {
  sortOrder: number;
  active: boolean;
}

export interface PublicSettings {
  whatsappNumber: string | null;
  companyName: string | null;
}

export interface AdminSettings extends PublicSettings {
  lowStockThreshold: number;
}

export interface ApiTestimonial {
  id: number;
  name: string;
  city: string | null;
  stars: number;
  text: string;
  avatar: string | null;
}

export interface AdminTestimonial extends ApiTestimonial {
  published: boolean;
  sortOrder: number;
}

// ---- Pedidos da loja

export type OrderStatus = "REQUESTED" | "CONFIRMED" | "CANCELED";

export interface OrderReceipt {
  id: number;
  status: OrderStatus;
  createdAt: string;
  items: {
    productId: number;
    productName: string;
    brand: string;
    description: string | null;
    unit: string;
    unitPrice: string | null;
    totalQuantity: number;
    flavors: { flavor: string | null; quantity: number }[];
  }[];
}

export interface OrderSaleLink {
  id: number;
  code: string;
  status: SaleStatus;
}

export interface OrderListItem {
  id: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  city: string;
  totalItems: number;
  sale: OrderSaleLink | null;
}

export interface OrderListResponse {
  items: OrderListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface OrderDetail {
  id: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  customerId: number | null;
  sale: OrderSaleLink | null;
  customer: {
    type: PersonKind;
    name: string;
    document: string;
    phone: string;
    zip: string;
    street: string;
    streetNumber: string;
    complement: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
  };
  items: {
    id: number;
    productId: number;
    productName: string;
    brand: string;
    unit: string;
    minQty: number;
    unitPrice: string | null;
    totalQuantity: number;
    flavors: { flavor: string | null; quantity: number }[];
  }[];
}

// ---- Clientes

export type PersonKind = "PF" | "PJ";

export interface CustomerStatsDto {
  totalBoughtWithDelivery: string;
  pendingAmount: string;
  deliveredCount: number;
  salesCount: number;
  topProduct: string | null;
  lastPurchase: string | null;
}

export interface CustomerRecord {
  id: number;
  code: string;
  type: PersonKind;
  name: string;
  tradeName: string | null;
  responsibleName: string | null;
  document: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  active: boolean;
  zip: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  stats: CustomerStatsDto;
}

export interface CustomerListResponse {
  items: CustomerRecord[];
  page: number;
  limit: number;
  total: number;
}

// ---- Vendas

export type SaleStatus = "DRAFT" | "CONFIRMED" | "DELIVERED" | "CANCELED";
export type PaymentStatusCode = "PENDING" | "PARTIAL" | "PAID";
export type PaymentMethodCode =
  | "pix"
  | "boleto"
  | "cartao_credito"
  | "cartao_debito"
  | "dinheiro"
  | "transferencia";

export interface SaleItemDto {
  id: number;
  productId: number | null;
  flavorId: number | null;
  productName: string;
  brand: string | null;
  unit: string | null;
  description: string | null;
  flavorName: string | null;
  notes: string | null;
  quantity: string;
  unitPrice: string;
  unitCost: string | null;
  subtotal: string;
}

export interface SaleDetail {
  id: number;
  code: string;
  status: SaleStatus;
  saleDate: string;
  customerId: number;
  orderId: number | null;
  customerName: string;
  customerPhone: string;
  customerDocument: string | null;
  deliveryAddress: Record<string, string | null>;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  paymentMethod: PaymentMethodCode | null;
  paymentStatus: PaymentStatusCode;
  paidAmount: string;
  pendingAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItemDto[];
}

export interface SaleListItem {
  id: number;
  code: string;
  status: SaleStatus;
  saleDate: string;
  customerId: number;
  customerName: string;
  total: string;
  paymentStatus: PaymentStatusCode;
  paidAmount: string;
  pendingAmount: string;
  itemCount: number;
}

export interface SaleListResponse {
  items: SaleListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface CustomerSaleHistory {
  id: number;
  code: string;
  saleDate: string;
  status: SaleStatus;
  paymentStatus: PaymentStatusCode;
  paymentMethod: PaymentMethodCode | null;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  paidAmount: string;
  notes: string | null;
  items: { productName: string; flavorName: string | null; quantity: string; unitPrice: string; subtotal: string }[];
}

// ---- Relatórios

export interface ReportKpis {
  revenue: string;
  cost: string | null;
  grossProfit: string | null;
  grossMargin: string | null;
  costIncomplete: boolean;
  saleCount: number;
  units: string;
  averageTicket: string | null;
  received: string | null;
  pending: string | null;
}

export interface ReportSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  productFilter: number[];
  current: ReportKpis;
  previous: ReportKpis;
  granularity: "day" | "month";
  series: { key: string; revenue: string; profit: string | null; units: string }[];
  ranking: {
    productId: number | null;
    name: string;
    brand: string | null;
    qty: string;
    revenue: string;
    cost: string | null;
    grossProfit: string | null;
    grossMargin: string | null;
  }[];
}
