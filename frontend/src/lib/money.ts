// Dinheiro trafega como texto "12.50" (sem ponto flutuante). Estas funções só convertem para exibir
// ou para validar o que o usuário digitou; os cálculos oficiais são feitos pelo banco.

export function brl(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "12,5" -> "12.50". Retorna null se não for um valor em reais com até 2 casas.
export function parseMoneyInput(raw: string): string | null {
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function percent(value: string | null): string {
  if (value === null) return "—";
  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}
