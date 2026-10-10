import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/errors.js";

// Regras puras de venda (sem banco). O banco continua sendo a autoridade: estas conferências só
// devolvem erros claros antes de chegar nos CHECKs/triggers.

const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export const ZERO = new Decimal(0);

export type PaymentStatusValue = "PENDING" | "PARTIAL" | "PAID";

export const brl = (value: Decimal) => `R$ ${value.toFixed(2).replace(".", ",")}`;

// Pendente só existe para vendas confirmadas/entregues (mesma regra de v_sales_summary).
export function pendingOf(status: string, total: Decimal, paid: Decimal): Decimal {
  return status === "CONFIRMED" || status === "DELIVERED" ? total.minus(paid) : ZERO;
}

// round(quantidade * preço, 2), como o trigger sale_items_prepare.
export function lineSubtotal(quantity: string, unitPrice: string): Decimal {
  return new Decimal(quantity).mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

// Pagamento coerente com o total (CHECKs do banco): PENDING = 0; PARTIAL entre 0 e total
// (exclusivos); PAID = total.
export function resolvePayment(
  input: { paymentStatus?: PaymentStatusValue; paidAmount?: string },
  current: { paymentStatus: string; paidAmount: Decimal },
  total: Decimal,
): { paymentStatus: PaymentStatusValue; paidAmount: Decimal } {
  const status = (input.paymentStatus ?? current.paymentStatus) as PaymentStatusValue;
  const provided = input.paidAmount === undefined ? undefined : new Decimal(input.paidAmount);

  if (status === "PENDING") {
    if (provided && !provided.isZero()) {
      throw new AppError(422, "PAYMENT_INVALID", "Pagamento pendente não tem valor recebido.");
    }
    return { paymentStatus: status, paidAmount: ZERO };
  }

  if (status === "PAID") {
    if (provided && !provided.equals(total)) {
      throw new AppError(422, "PAYMENT_INVALID", `Pago integralmente deve ser igual ao total (${brl(total)}).`);
    }
    return { paymentStatus: status, paidAmount: total };
  }

  const paid = provided ?? current.paidAmount;
  if (paid.lte(ZERO) || paid.gte(total)) {
    throw new AppError(
      422,
      "PAYMENT_INVALID",
      `Pagamento parcial: o valor recebido deve ser maior que zero e menor que o total (${brl(total)}).`,
    );
  }
  return { paymentStatus: status, paidAmount: paid };
}

// O desconto não pode superar o subtotal (CHECK discount <= subtotal).
export function assertDiscountFits(discount: Decimal, subtotal: Decimal, context: "update" | "item" | "remove"): void {
  if (!discount.gt(subtotal)) return;
  const message =
    context === "update"
      ? `O desconto não pode superar o subtotal (${brl(subtotal)}).`
      : context === "item"
        ? `O desconto (${brl(discount)}) passaria do subtotal (${brl(subtotal)}). Reduza o desconto primeiro.`
        : `Remover este item deixaria o desconto (${brl(discount)}) maior que o subtotal (${brl(subtotal)}). Reduza o desconto primeiro.`;
  throw new AppError(422, "DISCOUNT_TOO_HIGH", message);
}
