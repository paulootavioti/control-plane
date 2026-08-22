import { describe, expect, it, vi } from "vitest";
import { MercadoPagoHttp } from "./MercadoPagoHttp";

describe("MercadoPagoHttp", () => {
  it("cria assinatura pendente com referência e idempotência", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "preapproval-1", status: "pending", external_reference: "ass-1", init_point: "https://checkout.test" }),
    });
    const provedor = new MercadoPagoHttp({
      accessToken: "TEST-token",
      backUrl: "https://control.example.com/billing/retorno",
      baseUrl: "https://mp.test",
      fetchImpl,
    });

    const resultado = await provedor.criarAssinatura({
      referenciaExterna: "ass-1",
      clienteId: "cliente@example.com",
      pagadorEmail: "cliente@example.com",
      descricao: "Plano mensal",
      valorCentavos: 12990,
      moeda: "BRL",
      meioPagamento: "PIX",
      inicioEm: new Date("2026-09-01T12:00:00.000Z"),
    }, "assinatura:ass-1:v1");

    expect(resultado.checkoutUrl).toBe("https://checkout.test");
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers["X-Idempotency-Key"]).toBe("assinatura:ass-1:v1");
    expect(JSON.parse(init.body)).toMatchObject({
      external_reference: "ass-1",
      status: "pending",
      metadata: { meio_pagamento_preferido: "PIX" },
    });
  });

  it("não permite inicialização sem credencial", () => {
    expect(() => new MercadoPagoHttp({ accessToken: "", backUrl: "https://example.com" }))
      .toThrow("MERCADO_PAGO_ACCESS_TOKEN_AUSENTE");
  });

  it("exige HTTPS para API e retorno", () => {
    expect(() => new MercadoPagoHttp({ accessToken: "token", backUrl: "http://example.com" }))
      .toThrow("MERCADO_PAGO_URL_INSEGURA");
    expect(() => new MercadoPagoHttp({ accessToken: "token", backUrl: "https://example.com", baseUrl: "http://api.test" }))
      .toThrow("MERCADO_PAGO_URL_INSEGURA");
  });

  it("repete erro transitório e não incorpora mensagem remota no erro final", async () => {
    const aguardarImpl = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "indisponível" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "sub-1", status: "authorized" }) });
    const provedor = new MercadoPagoHttp({
      accessToken: "token", backUrl: "https://example.com", baseUrl: "https://api.test", fetchImpl, aguardarImpl,
    });
    await expect(provedor.obterAssinatura("sub-1")).resolves.toMatchObject({ id: "sub-1", status: "authorized" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(aguardarImpl).toHaveBeenCalledWith(100);

    const falha = new MercadoPagoHttp({
      accessToken: "token", backUrl: "https://example.com", baseUrl: "https://api.test",
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => JSON.stringify({ message: "cliente@example.com inválido" }) }),
    });
    await expect(falha.obterAssinatura("sub-1")).rejects.toThrow("MERCADO_PAGO_HTTP_400");
  });

  it("normaliza falha de rede e usa idempotência ao cancelar", async () => {
    const falhaRede = new MercadoPagoHttp({
      accessToken: "token", backUrl: "https://example.com", baseUrl: "https://api.test",
      fetchImpl: vi.fn().mockRejectedValue(new Error("socket")), aguardarImpl: vi.fn().mockResolvedValue(undefined),
    });
    await expect(falhaRede.obterAssinatura("sub-1")).rejects.toThrow("MERCADO_PAGO_INDISPONIVEL");

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    await new MercadoPagoHttp({ accessToken: "token", backUrl: "https://example.com", baseUrl: "https://api.test", fetchImpl })
      .cancelarAssinatura("sub/1");
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers["X-Idempotency-Key"]).toBe("cancelar:sub/1");
  });
});
