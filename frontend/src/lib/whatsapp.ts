import { formatCurrency, formatDate, normalizePhone } from "@/lib/format";
import type { CartItem, CustomerInfo, Quote } from "@/types";
import type { OrderReceipt } from "@/types/api";

function addressBlock(customer: CustomerInfo): string {
  return [
    customer.address && customer.number
      ? `${customer.address}, ${customer.number}${customer.complement ? ` — ${customer.complement}` : ""}`
      : customer.address || "—",
    customer.neighborhood || "",
    customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city || customer.state || "",
    customer.cep ? `CEP: ${customer.cep}` : "",
  ].filter(Boolean).join("\n");
}

// Mensagem FINAL: usa os dados oficiais devolvidos pela API depois que o pedido foi registrado
// (nome, marca e unidade do catálogo), não os que estavam no navegador.
export function buildReceiptMessage(customer: CustomerInfo, receipt: OrderReceipt, companyName: string): string {

  const itemLines = receipt.items.map((item) => {

    const head = `• ${item.productName} (${item.brand}) — ${item.unit} × ${item.totalQuantity}`;
    const flavors = item.flavors
      .filter((entry) => entry.flavor)
      .map((entry) => `\n   _Sabor: ${entry.flavor} × ${entry.quantity}_`)
      .join("");
    return `${head}${flavors}`;
  }).join("\n");

  return `🍬 *Novo Pedido nº ${receipt.id} — ${companyName}*

👤 *Cliente:* ${customer.name || "—"}
📄 *Tipo:* ${customer.personType === "fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
${customer.personType === "juridica" ? `🔢 *CNPJ:* ${customer.document}\n` : ""}
📞 *Telefone:* ${customer.phone || "—"}

📦 *Itens do Pedido:*
${itemLines || "—"}
📍 *Endereço de Entrega:*
${addressBlock(customer)}

_Pedido enviado pelo site ${companyName}_`;
}

// Apenas a PRÉVIA do modal: os dados ainda são os do navegador.
export function buildOrderMessage(customer: CustomerInfo, cart: CartItem[]) {

  const itemLines = cart.map((i) => {
    const flavorLine = i.selectedFlavor ? `\n   _Sabor: ${i.selectedFlavor}_` : "";
    return `• ${i.name} (${i.brand}) — ${i.unit} × ${i.qty}${flavorLine}`;
  }).join("\n");

  const enderecoLine = [
    customer.address && customer.number
      ? `${customer.address}, ${customer.number}${customer.complement ? ` — ${customer.complement}` : ""}`
      : customer.address || "—",
    customer.neighborhood || "",
    customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city || customer.state || "",
    customer.cep ? `CEP: ${customer.cep}` : "",
  ].filter(Boolean).join("\n");

  return `🍬 *Novo Pedido — D'mais Comercial de Doces*

👤 *Cliente:* ${customer.name || "—"}
📄 *Tipo:* ${customer.personType === "fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
${customer.personType === "juridica" ? `🔢 *CNPJ:* ${customer.document}\n` : ""}
📞 *Telefone:* ${customer.phone || "—"}

📦 *Itens do Pedido:*
${itemLines || "—"}

📍 *Endereço de Entrega:*
${enderecoLine || "—"}

_Pedido enviado pelo site D'mais Comercial de Doces_`;
}

export function buildQuoteMessage(q: Quote): string {
  const lines: string[] = [];
  lines.push("*D'mais Doceria* 🍬");
  lines.push("");
  lines.push(`Olá, *${q.customerName}*! 👋`);
  lines.push("");
  lines.push(`Segue o orçamento *${q.code}* de ${formatDate(q.createdAt.slice(0, 10))}:`);
  lines.push("");
  lines.push("*Itens:*");
  for (const item of q.items) {
    const sub = formatCurrency(item.subtotal);
    const unit = formatCurrency(item.unitPrice);
    lines.push(`• ${item.productName} — ${item.qty}x ${unit} = *${sub}*`);
    if (item.notes) lines.push(`  _${item.notes}_`);
  }
  lines.push("");
  if (q.discountAmount > 0) {
    lines.push(`Subtotal: ${formatCurrency(q.subtotal)}`);
    lines.push(`Desconto: -${formatCurrency(q.discountAmount)}`);
  }

  lines.push(`*Total: ${formatCurrency(q.total)}*`);
  if (q.validity) lines.push(`\n⏳ Válido até: ${formatDate(q.validity)}`);
  if (q.deliveryDate) lines.push(`📅 Previsão de entrega/retirada: ${formatDate(q.deliveryDate)}`);
  if (q.paymentTerms) lines.push(`💳 Condições de pagamento: ${q.paymentTerms}`);
  if (q.customerNotes) {
    lines.push("");
    lines.push(`📌 Observações: ${q.customerNotes}`);
  }
  lines.push("");
  lines.push("_D'mais Doceria_");
  return lines.join("\n");
}

export function formatPhoneForWA(phone: string): string {
  const d = normalizePhone(phone);
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length >= 10) return "55" + d;
  return d;
}
