import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chaveEventoMercadoPago, verificarAssinaturaMercadoPago } from "./verificarAssinaturaMercadoPago";

describe("assinatura do webhook Mercado Pago", () => {
  it("valida HMAC e janela anti-replay", () => {
    const segredo = "segredo-de-webhook-comprido";
    const ts = "1787227200";
    const manifesto = `id:pag-1;request-id:req-1;ts:${ts};`;
    const v1 = createHmac("sha256", segredo).update(manifesto).digest("hex");
    expect(() => verificarAssinaturaMercadoPago({
      assinatura: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "pag-1",
    }, segredo, Number(ts))).not.toThrow();
  });

  it("rejeita evento antigo", () => {
    expect(() => verificarAssinaturaMercadoPago({
      assinatura: "ts=1,v1=abc", requestId: "req", dataId: "pag",
    }, "segredo-de-webhook-comprido", 1000)).toThrow("ASSINATURA_WEBHOOK_EXPIRADA");
  });

  it("produz chave idempotente estável", () => {
    expect(chaveEventoMercadoPago("payment", "payment.updated", "42"))
      .toBe("payment:payment.updated:42");
  });
});
