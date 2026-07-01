export interface Receita {
  id: string;
  descricao: string;
  placa_modelo?: string | null;
  data: string; // YYYY-MM-DD
  valor: number;
  status_recebimento: 'pendente' | 'recebido';
  recorrente?: boolean;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  status_pagamento: 'pendente' | 'pago';
  tipo?: 'geral' | 'adicional';
  recorrente?: boolean;
}

export interface FaturaCartao {
  id: string;
  nome_cartao: string;
  finais_cartao?: string; // Finais do cartão, ex: "4321"
  limite_total?: number;  // Limite Total
  gastos_totais?: number; // Gastos Totais
  limite_atual?: number;  // Limite Atual (Limite Total - Gastos Totais)
  melhor_dia_compra?: number; // Melhor Dia de Compra (Dia do mês)
  valor_total: number;
  data_vencimento: string; // YYYY-MM-DD
  status_pagamento: 'pendente' | 'pago';
}

export interface PagamentoDiario {
  id: string;
  descricao: string;
  parcela_atual: number;
  parcela_total: number;
  valor_pago: number;
  valor_saldo: number;
  segunda_a_sexta: boolean; // Se é de segunda a sexta
  data: string; // YYYY-MM-DD
  status: 'pendente' | 'recebido';
  valor_parcela?: number; // Valor de cada parcela
  valor_pago_mes?: number; // Valor pago/recebido no mês atual
}

export interface DividaOutros {
  id: string;
  devedor: string;
  tipo: 'aluguel' | 'divida' | 'outros';
  valor_total: number;
  valor_pago: number;
  saldo_devedor: number; // valor_total - valor_pago
  data_vencimento: string; // YYYY-MM-DD
  status: 'pendente' | 'pago' | 'atrasado';
  recorrente?: boolean;
}

export interface Prestacao {
  id: string;
  descricao: string;
  valor_parcela: number;
  parcelas_pagas: number;
  parcelas_totais: number;
  data_vencimento: string; // YYYY-MM-DD
  status: 'pendente' | 'pago';
}

export interface PushSubscriptionData {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at: string;
}

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'warning' | 'info' | 'success';
}
