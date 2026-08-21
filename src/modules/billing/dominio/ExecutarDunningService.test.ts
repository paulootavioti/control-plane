import { describe, expect, it, vi } from "vitest";
import { ExecutarDunningService } from "./ExecutarDunningService";

function tentativa(acao: string, diaRegua: number, produtoCodigo = "psyche") {
  return {
    id: "tent-1", acao, diaRegua,
    assinatura: {
      id: "ass-1", assinanteId: "cli-1", produtoCodigo,
      assinante: { emailCobranca: "financeiro@example.com" },
    },
  };
}

describe("ExecutarDunningService", () => {
  it("suspende somente o produto e enfileira notificação em D10", async () => {
    const tx = { assinatura: { update: vi.fn() }, tenantProduto: { updateMany: vi.fn() } };
    const db = {
      tentativaDunning: {
        findFirst: vi.fn().mockResolvedValue(tentativa("SUSPENDER_ADMINISTRATIVO", 10)),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn(),
      },
      assinatura: { findUnique: vi.fn().mockResolvedValue({ id: "ass-1", status: "INADIMPLENTE", gatewayAssinaturaId: "sub-1" }) },
      $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx),
    };
    const provedor = { obterAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "paused", referenciaExterna: "ass-1" }) };
    const notificador = { enfileirar: vi.fn() };
    expect(await new ExecutarDunningService(db as never, provedor as never, notificador).executarProxima())
      .toBe("PROCESSADO");
    expect(tx.tenantProduto.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assinanteId: "cli-1", produtoCodigo: "psyche" }),
      data: { status: "SUSPENSO_FINANCEIRO" },
    }));
    expect(db.tentativaDunning.findFirst.mock.calls[0][0].where.OR)
      .toEqual(expect.arrayContaining([expect.objectContaining({ status: "EXECUTANDO" })]));
    expect(notificador.enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "ASSINATURA_SUSPENSA" }));
  });

  it("não suspende quando a reconciliação encontra pagamento", async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 3 });
    const tx = {
      assinatura: { update: vi.fn() },
      tentativaDunning: { updateMany },
      tenantProduto: { updateMany: vi.fn() },
    };
    const db = {
      tentativaDunning: {
        findFirst: vi.fn().mockResolvedValue(tentativa("SUSPENDER_ADMINISTRATIVO", 10, "sysbelt")),
        updateMany, update: vi.fn(),
      },
      assinatura: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ass-1", assinanteId: "cli-1", produtoCodigo: "sysbelt",
          status: "INADIMPLENTE", gatewayAssinaturaId: "sub-1",
        }),
      },
      $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx),
    };
    const provedor = { obterAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "authorized", referenciaExterna: "ass-1" }) };
    const notificador = { enfileirar: vi.fn() };
    await new ExecutarDunningService(db as never, provedor as never, notificador).executarProxima();
    expect(tx.assinatura.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ATIVA" }) }));
    expect(notificador.enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "ASSINATURA_REATIVADA" }));
  });
});
