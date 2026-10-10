import type {
  OrderStatus,
  PaymentMethodCode,
  PaymentStatusCode,
  SaleStatus,
} from "@/types/api";
import type { PaymentMethod, PaymentStatus, QuoteStatus, SaleStatus as LegacySaleStatus } from "@/types";

// Rótulos dos códigos da API (banco).
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmada",
  DELIVERED: "Entregue",
  CANCELED: "Cancelada",
};

export const SALE_STATUS_STYLES: Record<SaleStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-sky-100 text-sky-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELED: "bg-red-100 text-red-600",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatusCode, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
};

export const PAYMENT_STATUS_STYLES: Record<PaymentStatusCode, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodCode, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export const PAYMENT_METHOD_SHORT_LABELS: Record<PaymentMethodCode, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  REQUESTED: "Solicitado",
  CONFIRMED: "Confirmado (venda)",
  CANCELED: "Cancelado",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELED: "bg-red-100 text-red-600",
};

// ---- PROVISÓRIO: rótulos do módulo de orçamentos (escondido por SHOW_QUOTES), ainda no formato
// antigo do localStorage.
export const LEGACY_PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export const LEGACY_PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
};

export const LEGACY_SALE_STATUS_LABELS: Record<LegacySaleStatus, string> = {
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; badge: string }> = {
  em_aberto: { label: "Em aberto", color: "#27408A", badge: "bg-blue-100 text-blue-700" },
  fechado: { label: "Fechado", color: "#16a34a", badge: "bg-green-100 text-green-700" },
  nao_fechado: { label: "Não fechado", color: "#94a3b8", badge: "bg-slate-100 text-slate-600" },
};
