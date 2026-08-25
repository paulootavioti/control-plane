import type {
  AssinaturaRemota, CriarAssinaturaPagamento, CriarClientePagamento, ProvedorPagamento,
} from "./ProvedorPagamento";

interface MercadoPagoHttpOptions {
  accessToken: string;
  baseUrl?: string;
  backUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxTentativas?: number;
  aguardarImpl?: (ms: number) => Promise<void>;
}

interface RespostaMercadoPago {
  id?: string | number;
  status?: string;
  external_reference?: string;
  init_point?: string;
  message?: string;
}

interface UsuarioMercadoPago {
  id?: string | number;
  site_id?: string;
  status?: { site_status?: string };
}

export class MercadoPagoHttp implements ProvedorPagamento {
  readonly nome = "MERCADO_PAGO" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxTentativas: number;
  private readonly aguardar: (ms: number) => Promise<void>;

  constructor(private readonly options: MercadoPagoHttpOptions) {
    if (!options.accessToken.trim()) throw new Error("MERCADO_PAGO_ACCESS_TOKEN_AUSENTE");
    this.baseUrl = options.baseUrl ?? "https://api.mercadopago.com";
    if (!this.urlHttpsValida(this.baseUrl) || !this.urlHttpsValida(options.backUrl)) {
      throw new Error("MERCADO_PAGO_URL_INSEGURA");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxTentativas = options.maxTentativas ?? 3;
    this.aguardar = options.aguardarImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    if (this.timeoutMs < 1_000 || this.timeoutMs > 30_000 || this.maxTentativas < 1 || this.maxTentativas > 3) {
      throw new Error("MERCADO_PAGO_CONFIGURACAO_HTTP_INVALIDA");
    }
  }

  private urlHttpsValida(valor: string) {
    try { return new URL(valor).protocol === "https:"; } catch { return false; }
  }

  private async lerCorpo(resposta: Response): Promise<RespostaMercadoPago> {
    try {
      if (typeof resposta.text === "function") {
        const texto = await resposta.text();
        return texto ? JSON.parse(texto) as RespostaMercadoPago : {};
      }
      return await resposta.json() as RespostaMercadoPago;
    } catch { return {}; }
  }

  private async chamar(path: string, init: RequestInit, chaveIdempotencia?: string): Promise<RespostaMercadoPago> {
    for (let tentativa = 1; tentativa <= this.maxTentativas; tentativa += 1) {
      try {
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        const resposta = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          signal,
          headers: {
            Authorization: `Bearer ${this.options.accessToken}`,
            "Content-Type": "application/json",
            ...(chaveIdempotencia ? { "X-Idempotency-Key": chaveIdempotencia } : {}),
            ...init.headers,
          },
        });
        const corpo = await this.lerCorpo(resposta);
        if (resposta.ok) return corpo;
        const repetivel = resposta.status === 429 || resposta.status >= 500;
        if (!repetivel || tentativa === this.maxTentativas) throw new Error(`MERCADO_PAGO_HTTP_${resposta.status}`);
      } catch (erro) {
        if (erro instanceof Error && erro.message.startsWith("MERCADO_PAGO_HTTP_")) throw erro;
        if (tentativa === this.maxTentativas) {
          const timeout = erro instanceof Error && ["AbortError", "TimeoutError"].includes(erro.name);
          throw new Error(timeout ? "MERCADO_PAGO_TEMPO_ESGOTADO" : "MERCADO_PAGO_INDISPONIVEL");
        }
      }
      await this.aguardar(100 * (2 ** (tentativa - 1)));
    }
    throw new Error("MERCADO_PAGO_INDISPONIVEL");
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
    }, `cancelar:${id}`);
  }

  async validarCredencial(): Promise<{ contaId: string; siteId: string; ativa: boolean }> {
    const corpo = await this.chamar("/users/me", { method: "GET" }) as UsuarioMercadoPago;
    if (!corpo.id || !corpo.site_id) throw new Error("MERCADO_PAGO_RESPOSTA_CREDENCIAL_INVALIDA");
    return {
      contaId: String(corpo.id),
      siteId: corpo.site_id,
      ativa: corpo.status?.site_status !== "blocked",
    };
  }
}
