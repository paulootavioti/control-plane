import { describe, expect, it, vi } from "vitest";
import { executarCicloBilling } from "./executarCicloBilling";

describe("executarCicloBilling", () => {
  it("encerra filas vazias e reconcilia assinaturas elegíveis", async () => {
    const db = {
      eventoWebhookPagamento: { findFirst: vi.fn().mockResolvedValue(null) },
      tentativaDunning: { findFirst: vi.fn().mockResolvedValue(null) },
      assinatura: {
        findMany: vi.fn().mockResolvedValue([{ id: "ass-1" }]),
        findUnique: vi.fn().mockResolvedValue({
          id: "ass-1", assinanteId: "cli-1", produtoCodigo: "sysbelt",
          status: "ATIVA", gatewayAssinaturaId: "sub-1",
        }),
      },
    };
    const provedor = { obterAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "authorized", referenciaExterna: "ass-1" }) };
    expect(await executarCicloBilling(db as never, provedor as never, 3)).toEqual({
      eventos: 0, dunning: 0, reconciliacoes: 1, falhas: 0,
    });
  });
});
