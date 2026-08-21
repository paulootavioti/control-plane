export type MeioPagamentoRecorrente = "CARTAO" | "PIX";

export interface CriarClientePagamento {
  referenciaExterna: string;
  email: string;
  nome: string;
}

export interface CriarAssinaturaPagamento {
  referenciaExterna: string;
  clienteId: string;
  pagadorEmail: string;
  descricao: string;
  valorCentavos: number;
  moeda: "BRL";
  meioPagamento: MeioPagamentoRecorrente;
  inicioEm: Date;
}

export interface AssinaturaRemota {
  id: string;
  status: string;
  referenciaExterna: string;
  checkoutUrl?: string;
}

export interface ProvedorPagamento {
  readonly nome: "MERCADO_PAGO" | "FAKE";
  criarCliente(dados: CriarClientePagamento, chaveIdempotencia: string): Promise<{ id: string }>;
  criarAssinatura(dados: CriarAssinaturaPagamento, chaveIdempotencia: string): Promise<AssinaturaRemota>;
  obterAssinatura(id: string): Promise<AssinaturaRemota>;
  cancelarAssinatura(id: string): Promise<void>;
}
