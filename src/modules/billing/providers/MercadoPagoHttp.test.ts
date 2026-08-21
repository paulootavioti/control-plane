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
});
