import { api, apiText } from "@/services/api";
import type {
  AdminCategory,
  AdminProduct,
  AdminSettings,
  AdminTestimonial,
  ApiCategory,
  ApiProduct,
  ApiTestimonial,
  CustomerListResponse,
  CustomerRecord,
  CustomerSaleHistory,
  OrderDetail,
  OrderListResponse,
  OrderReceipt,
  OrderStatus,
  PaymentMethodCode,
  PaymentStatusCode,
  PersonKind,
  PublicSettings,
  ReportSummary,
  SaleDetail,
  SaleListResponse,
  SaleStatus,
} from "@/types/api";

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

// ---------------------------------------------------------------- públicas (loja)

export const storeApi = {
  products: () => api<ApiProduct[]>("/api/products"),
  categories: () => api<ApiCategory[]>("/api/categories"),
  settings: () => api<PublicSettings>("/api/settings"),
  testimonials: () => api<ApiTestimonial[]>("/api/testimonials"),
  createOrder: (body: { requestId: string; customer: unknown; items: unknown }) =>
    api<OrderReceipt>("/api/orders", { method: "POST", body }),
};

// ---------------------------------------------------------------- administração

export interface ProductPayload {
  name: string;
  brand: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: number;
  price: string;
  cost: string | null;
  unit: string;
  unitDescription?: string | null;
  minQty: number;
  bestSeller: boolean;
  featured: boolean;
  stars: number;
  active: boolean;
}

export interface CustomerPayload {
  type: PersonKind;
  name: string;
  tradeName: string | null;
  responsibleName: string | null;
  document: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  zip: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface SalePatch {
  saleDate?: string;
  discount?: string;
  deliveryFee?: string;
  paymentMethod?: PaymentMethodCode | null;
  paymentStatus?: PaymentStatusCode;
  paidAmount?: string;
  notes?: string | null;
}

export interface SaleItemPayload {
  productId?: number;
  flavorId?: number | null;
  productName?: string;
  quantity: string;
  unitPrice?: string;
  notes?: string | null;
}

export const adminApi = {
  settings: () => api<AdminSettings>("/api/admin/settings", { auth: true }),

  categories: () => api<AdminCategory[]>("/api/admin/categories", { auth: true }),
  createCategory: (body: { name: string; sortOrder?: number }) =>
    api<AdminCategory>("/api/admin/categories", { method: "POST", body, auth: true }),
  updateCategory: (id: number, body: Partial<{ name: string; sortOrder: number; active: boolean }>) =>
    api<AdminCategory>(`/api/admin/categories/${id}`, { method: "PATCH", body, auth: true }),

  products: () => api<AdminProduct[]>("/api/admin/products", { auth: true }),
  createProduct: (body: ProductPayload & { initialStock: number; flavors: string[] }) =>
    api<AdminProduct>("/api/admin/products", { method: "POST", body, auth: true }),
  updateProduct: (id: number, body: Partial<ProductPayload>) =>
    api<AdminProduct>(`/api/admin/products/${id}`, { method: "PATCH", body, auth: true }),
  adjustStock: (id: number, body: { delta: number; reason: string }) =>
    api<{ id: number; stock: number }>(`/api/admin/products/${id}/stock`, { method: "POST", body, auth: true }),
  createFlavor: (productId: number, name: string) =>
    api<{ id: number; name: string; active: boolean }>(`/api/admin/products/${productId}/flavors`, {
      method: "POST",
      body: { name },
      auth: true,
    }),
  updateFlavor: (productId: number, flavorId: number, body: Partial<{ name: string; active: boolean }>) =>
    api<{ id: number; name: string; active: boolean }>(`/api/admin/products/${productId}/flavors/${flavorId}`, {
      method: "PATCH",
      body,
      auth: true,
    }),

  orders: (params: { status?: OrderStatus; page?: number; limit?: number }) =>
    api<OrderListResponse>(`/api/orders${qs(params)}`, { auth: true }),
  order: (id: number) => api<OrderDetail>(`/api/orders/${id}`, { auth: true }),
  cancelOrder: (id: number) =>
    api<{ id: number; status: OrderStatus }>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: { status: "CANCELED" },
      auth: true,
    }),

  customers: (params: { q?: string; type?: PersonKind; active?: boolean; page?: number; limit?: number }) =>
    api<CustomerListResponse>(`/api/admin/customers${qs(params)}`, { auth: true }),
  createCustomer: (body: CustomerPayload) =>
    api<CustomerRecord>("/api/admin/customers", { method: "POST", body, auth: true }),
  updateCustomer: (id: number, body: Partial<CustomerPayload> & { active?: boolean }) =>
    api<CustomerRecord>(`/api/admin/customers/${id}`, { method: "PATCH", body, auth: true }),
  customerSales: (id: number) => api<CustomerSaleHistory[]>(`/api/admin/customers/${id}/sales`, { auth: true }),

  sales: (params: { status?: SaleStatus; customerId?: number; from?: string; to?: string; q?: string; page?: number; limit?: number }) =>
    api<SaleListResponse>(`/api/admin/sales${qs(params)}`, { auth: true }),
  sale: (id: number) => api<SaleDetail>(`/api/admin/sales/${id}`, { auth: true }),
  createSale: (body: { customerId: number; saleDate?: string; paymentMethod?: PaymentMethodCode | null; notes?: string | null }) =>
    api<SaleDetail>("/api/admin/sales", { method: "POST", body, auth: true }),
  createSaleFromOrder: (orderId: number) =>
    api<SaleDetail>(`/api/admin/sales/from-order/${orderId}`, { method: "POST", auth: true }),
  updateSale: (id: number, body: SalePatch) =>
    api<SaleDetail>(`/api/admin/sales/${id}`, { method: "PATCH", body, auth: true }),
  confirmSale: (id: number) => api<SaleDetail>(`/api/admin/sales/${id}/confirm`, { method: "POST", auth: true }),
  cancelSale: (id: number) => api<SaleDetail>(`/api/admin/sales/${id}/cancel`, { method: "POST", auth: true }),
  deliverSale: (id: number) => api<SaleDetail>(`/api/admin/sales/${id}/deliver`, { method: "POST", auth: true }),
  addSaleItem: (id: number, body: SaleItemPayload) =>
    api<SaleDetail>(`/api/admin/sales/${id}/items`, { method: "POST", body, auth: true }),
  updateSaleItem: (id: number, itemId: number, body: Partial<SaleItemPayload>) =>
    api<SaleDetail>(`/api/admin/sales/${id}/items/${itemId}`, { method: "PATCH", body, auth: true }),
  removeSaleItem: (id: number, itemId: number) =>
    api<SaleDetail>(`/api/admin/sales/${id}/items/${itemId}`, { method: "DELETE", auth: true }),

  reportSummary: (params: { from: string; to: string; productIds?: number[] }) =>
    api<ReportSummary>(
      `/api/admin/reports/summary${qs({ from: params.from, to: params.to, productIds: params.productIds?.join(",") })}`,
      { auth: true },
    ),
  salesCsv: (params: { from: string; to: string }) =>
    apiText(`/api/admin/reports/sales.csv${qs(params)}`, { auth: true }),

  testimonials: () => api<AdminTestimonial[]>("/api/admin/testimonials", { auth: true }),
  createTestimonial: (body: Omit<AdminTestimonial, "id">) =>
    api<AdminTestimonial>("/api/admin/testimonials", { method: "POST", body, auth: true }),
  updateTestimonial: (id: number, body: Partial<Omit<AdminTestimonial, "id">>) =>
    api<AdminTestimonial>(`/api/admin/testimonials/${id}`, { method: "PATCH", body, auth: true }),
};
