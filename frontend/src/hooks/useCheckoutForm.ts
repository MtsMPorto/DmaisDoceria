import { useState } from "react";
import { isValidCnpj, isValidCpf, isValidUf, onlyDigits } from "@/lib/document";
import type { CustomerInfo } from "@/types";

// Dados do cliente no fluxo "Enviar pedido pelo WhatsApp". O estado fica na loja para
// sobreviver a fechar e reabrir o modal. Validações iguais às do backend (Zod) e do banco.
export function useCheckoutForm() {
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: "", personType: "fisica", document: "", phone: "",
    cep: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});

  function validate() {
    const e: Partial<Record<keyof CustomerInfo, string>> = {};
    if (!customer.name.trim()) e.name = "Nome obrigatório";

    const document = onlyDigits(customer.document);
    if (!document) e.document = "Documento obrigatório";
    else if (customer.personType === "fisica" && !isValidCpf(document)) e.document = "CPF inválido";
    else if (customer.personType === "juridica" && !isValidCnpj(document)) e.document = "CNPJ inválido";

    const phone = onlyDigits(customer.phone);
    if (!phone) e.phone = "Telefone obrigatório";
    else if (phone.length !== 10 && phone.length !== 11) e.phone = "Telefone deve ter 10 ou 11 dígitos (com DDD)";

    const cep = onlyDigits(customer.cep);
    if (!cep) e.cep = "CEP obrigatório";
    else if (cep.length !== 8) e.cep = "CEP deve ter 8 dígitos";

    if (!customer.address.trim()) e.address = "Endereço obrigatório";
    if (!customer.number.trim()) e.number = "Número obrigatório";
    if (!customer.neighborhood.trim()) e.neighborhood = "Bairro obrigatório";
    if (!customer.city.trim()) e.city = "Cidade obrigatória";
    if (!customer.state.trim()) e.state = "Estado obrigatório";
    else if (!isValidUf(customer.state)) e.state = "UF inválida";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return { customer, setCustomer, errors, validate };
}

export type CheckoutForm = ReturnType<typeof useCheckoutForm>;
