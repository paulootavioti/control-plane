import type { MensagemNotificacaoBilling, TransportadorNotificacaoBilling } from "./TransportadorNotificacaoBilling";

export class TransportadorNotificacaoWebhook implements TransportadorNotificacaoBilling {
  private readonly url: URL;

  constructor(url: string, private readonly token: string) {
    this.url = new URL(url);
    if (this.url.protocol !== "https:" || token.length < 32) throw new Error("TRANSPORTE_NOTIFICACAO_INVALIDO");
  }

  async enviar(mensagem: MensagemNotificacaoBilling): Promise<void> {
    const resposta = await fetch(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "idempotency-key": mensagem.chaveIdempotencia,
      },
      body: JSON.stringify(mensagem),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) throw new Error(`TRANSPORTE_HTTP_${resposta.status}`);
  }
}
