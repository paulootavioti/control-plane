import type {
  AssinaturaRemota, CriarAssinaturaPagamento, CriarClientePagamento, ProvedorPagamento,
} from "./ProvedorPagamento";

interface MercadoPagoHttpOptions {
  accessToken: string;
  baseUrl?: string;
  backUrl: string;
  fetchImpl?: typeof fetch;
}

interface RespostaMercadoPago {
  id?: string | number;
  status?: string;
  external_reference?: string;
  init_point?: string;
  message?: string;
}

export class MercadoPagoHttp implements ProvedorPagamento {
  readonly nome = "MERCADO_PAGO" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MercadoPagoHttpOptions) {
    if (!options.accessToken.trim()) throw new Error("MERCADO_PAGO_ACCESS_TOKEN_AUSENTE");
    this.baseUrl = options.baseUrl ?? "https://api.mercadopago.com";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async chamar(path: string, init: RequestInit, chaveIdempotencia?: string): Promise<RespostaMercadoPago> {
    const resposta = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        "Content-Type": "application/json",
        ...(chaveIdempotencia ? { "X-Idempotency-Key": chaveIdempotencia } : {}),
        ...init.headers,
      },
    });
    const corpo = await resposta.json() as RespostaMercadoPago;
    if (!resposta.ok) {
      throw new Error(`MERCADO_PAGO_HTTP_${resposta.status}:${corpo.message ?? "erro sem mensagem"}`);
    }
    return corpo;
  }

  async criarCliente(dados: CriarClientePagamento, chaveIdempotencia: string) {
    const corpo = await this.chamar("/v1/customers", {
      method: "POST",
      body: JSON.stringify({
        email: dados.email,
        first_name: dados.nome,
        description: dados.referenciaExterna,
      }),
    }, chaveIdempotencia);
    if (!corpo.id) throw new Error("MERCADO_PAGO_RESPOSTA_CLIENTE_INVALIDA");
    return { id: String(corpo.id) };
  }

  async criarAssinatura(dados: CriarAssinaturaPagamento, chaveIdempotencia: string): Promise<AssinaturaRemota> {
    const corpo = await this.chamar("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: dados.descricao,
        external_reference: dados.referenciaExterna,
        payer_email: dados.pagadorEmail,
        back_url: this.options.backUrl,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: dados.valorCentavos / 100,
          currency_id: dados.moeda,
          start_date: dados.inicioEm.toISOString(),
        },
        metadata: { cliente_id: dados.clienteId, meio_pagamento_preferido: dados.meioPagamento },
      }),
    }, chaveIdempotencia);
    if (!corpo.id || !corpo.status) throw new Error("MERCADO_PAGO_RESPOSTA_ASSINATURA_INVALIDA");
    return {
      id: String(corpo.id),
      status: corpo.status,
      referenciaExterna: corpo.external_reference ?? dados.referenciaExterna,
      checkoutUrl: corpo.init_point,
    };
  }

  async obterAssinatura(id: string): Promise<AssinaturaRemota> {
    const corpo = await this.chamar(`/preapproval/${encodeURIComponent(id)}`, { method: "GET" });
    if (!corpo.id || !corpo.status) throw new Error("MERCADO_PAGO_RESPOSTA_ASSINATURA_INVALIDA");
    return {
      id: String(corpo.id),
      status: corpo.status,
      referenciaExterna: corpo.external_reference ?? "",
      checkoutUrl: corpo.init_point,
    };
  }

  async cancelarAssinatura(id: string): Promise<void> {
    await this.chamar(`/preapproval/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
  }
}
