import { describe, expect, it, vi } from "vitest";
import { ProcessarEventoWebhookService } from "./ProcessarEventoWebhookService";

describe("ProcessarEventoWebhookService", () => {
  it("reconcilia assinatura e agenda dunning após evento de inadimplência", async () => {
    const tx = {
      assinatura: { update: vi.fn() },
      tentativaDunning: { updateMany: vi.fn(), upsert: vi.fn() },
      tenantProduto: { updateMany: vi.fn() },
    };
    const db = {
      eventoWebhookPagamento: {
        findFirst: vi.fn().mockResolvedValue({
          id: "evt-1", tipo: "subscription_preapproval", status: "RECEBIDO", payloadBruto: { data: { id: "sub-1" } },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn(),
      },
      assinatura: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: "ass-1" })
          .mockResolvedValueOnce({ id: "ass-1", assinanteId: "cli-1", produtoCodigo: "sysbelt", status: "ATIVA", gatewayAssinaturaId: "sub-1" }),
      },
      $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx),
    };
    const provedor = { obterAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "paused", referenciaExterna: "ass-1" }) };
    expect(await new ProcessarEventoWebhookService(db as never, provedor as never).executarProximo()).toBe("PROCESSADO");
    expect(tx.tentativaDunning.upsert).toHaveBeenCalledTimes(5);
    expect(db.eventoWebhookPagamento.findFirst.mock.calls[0][0].where.OR)
      .toEqual(expect.arrayContaining([expect.objectContaining({ status: "PROCESSANDO" })]));
    expect(db.eventoWebhookPagamento.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSADO" }) }));
  });
});
