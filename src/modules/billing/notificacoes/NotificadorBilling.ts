export interface DadosNotificacaoBilling {
  assinaturaId: string;
  destinatario: string;
  tipo: "PAGAMENTO_FALHOU" | "RETENTATIVA_PENDENTE" | "ASSINATURA_SUSPENSA" | "ASSINATURA_REATIVADA";
  diaRegua: number;
  produtoCodigo: string;
}

export interface NotificadorBilling {
  enfileirar(dados: DadosNotificacaoBilling): Promise<{ criada: boolean }>;
}
