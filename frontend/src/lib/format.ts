import type { PersonType } from "@/types";

export function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPercent(v: number): string {
  return `${v.toFixed(1).replace(".",",")}%`;
}

export function formatDocument(value: string, type: PersonType) {
  const digits = value.replace(/\D/g, "");
  if (type === "fisica") {
    return digits.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14).replace(/([A-Z0-9]{2})([A-Z0-9])/, "$1.$2").replace(/([A-Z0-9]{3})([A-Z0-9])/, "$1.$2").replace(/([A-Z0-9]{3})([A-Z0-9])/, "$1/$2").replace(/([A-Z0-9]{4})([0-9]{1,2})$/, "$1-$2");
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2");
}

export function formatCEP(value: string) {
  return value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
