export type PersonType = "fisica" | "juridica";

// Dados preenchidos pelo cliente na loja, ao enviar o pedido pelo WhatsApp.
export interface CustomerInfo {
  name: string;
  personType: PersonType;
  document: string;
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

// Cadastro de cliente do painel administrativo.
export interface Customer {
  id: string;
  code: string;
  personType: PersonType;
  name: string;
  nomeFantasia?: string;
  cnpj?: string;
  cpf?: string;
  nomeResponsavel?: string;
  phone: string;
  email?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerStats {
  totalComprado: number;
  valorPendente: number;
  topProduct: string;
  lastDate: string;
  totalSales: number;
  concludedCount: number;
}
