export type QuoteStatus = "em_aberto" | "fechado" | "nao_fechado";
export type DiscountType = "reais" | "percentual";

export interface QuoteItem {
  productId: number;
  productName: string;
  productBrand: string;
  productUnit: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
  notes: string;
}

export interface Quote {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: QuoteItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  validity: string;
  deliveryDate: string;
  paymentTerms: string;
  customerNotes: string;
  internalNotes: string;
  status: QuoteStatus;
  closedReason: string;
  closedAt: string;
  convertedSaleId: string;
  createdAt: string;
}
