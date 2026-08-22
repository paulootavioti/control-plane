import { afterEach, describe, expect, it, vi } from "vitest";
import { TransportadorNotificacaoWebhook } from "./TransportadorNotificacaoWebhook";

describe("transporte webhook de notificações", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recusa endpoint sem TLS e token fraco", () => {
    expect(() => new TransportadorNotificacaoWebhook("http://example.com", "x".repeat(32)))
      .toThrow("TRANSPORTE_NOTIFICACAO_INVALIDO");
    expect(() => new TransportadorNotificacaoWebhook("https://example.com", "curto"))
      .toThrow("TRANSPORTE_NOTIFICACAO_INVALIDO");
  });

  it("envia token e chave idempotente sem colocá-los na URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const transportador = new TransportadorNotificacaoWebhook("https://example.com/entregar", "t".repeat(32));
    await transportador.enviar({ id: "n1", chaveIdempotencia: "chave-1", tipo: "DUNNING", destinatario: "a@b.com", dados: {} });
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://example.com/entregar"), expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: `Bearer ${"t".repeat(32)}`, "idempotency-key": "chave-1" }),
    }));
  });

  it("converte resposta não sucedida em erro sanitizável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const transportador = new TransportadorNotificacaoWebhook("https://example.com", "t".repeat(32));
    await expect(transportador.enviar({ id: "n1", chaveIdempotencia: "c", tipo: "x", destinatario: "a", dados: {} }))
      .rejects.toThrow("TRANSPORTE_HTTP_503");
  });
});
