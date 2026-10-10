export type PaymentStatus = "pendente" | "parcial" | "pago";
export type SaleStatus = "em_andamento" | "concluida" | "cancelada";
export type PaymentMethod =
  | "pix"
  | "boleto"
  | "cartao_credito"
  | "cartao_debito"
  | "dinheiro"
  | "transferencia";

export interface SaleItem {
  productId: number;
  productName: string;
  productBrand: string;
  productUnit: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
  productCost?: number;
}

export interface Sale {
  id: string;
  customerId: string;
  date: string;
  items: SaleItem[];
  discount: number;
  deliveryFee: number;
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  saleStatus: SaleStatus;
  notes?: string;
  createdAt: string;
  paidAmount?: number;
  quoteId?: string;
}
