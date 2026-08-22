export interface MensagemNotificacaoBilling {
  id: string;
  chaveIdempotencia: string;
  tipo: string;
  destinatario: string;
  dados: unknown;
}

export interface TransportadorNotificacaoBilling {
  enviar(mensagem: MensagemNotificacaoBilling): Promise<void>;
}
