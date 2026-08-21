import { describe, expect, it, vi } from "vitest";
import { ReprocessarNotificacaoBillingService } from "./ReprocessarNotificacaoBillingService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: "127.0.0.1", userAgent: "teste" };

function banco(notificacao: unknown, adquiridos = 1) {
  const tx = {
    notificacaoBilling: {
      findUnique: vi.fn().mockResolvedValue(notificacao),
      updateMany: vi.fn().mockResolvedValue({ count: adquiridos }),
    },
    auditLogPlataforma: { create: vi.fn().mockResolvedValue({}) },
  };
  return { db: { $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx) }, tx };
}

describe("reprocessamento manual de notificação", () => {
  it("retoma falha na data solicitada e vincula auditoria ao assinante", async () => {
    const agora = new Date("2026-08-21T12:00:00Z");
    const { db, tx } = banco({
      id: "n1", status: "FALHOU", tentativas: 4, tipo: "DUNNING_DIA_7",
      assinatura: { assinanteId: "a1" },
    });
    await expect(new ReprocessarNotificacaoBillingService(db as never).execute("n1", auditoria, agora))
      .resolves.toEqual({ notificacaoId: "n1", duplicado: false });
    expect(tx.notificacaoBilling.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", status: "FALHOU" },
      data: {
        status: "PENDENTE", tentativas: 0, erroSanitizado: null,
        proximaTentativaEm: agora, enviadaEm: null,
      },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      assinanteId: "a1", acao: "BILLING_NOTIFICACAO_REPROCESSADA", alvoId: "n1",
      mudancas: { tentativasAnteriores: 4, tipo: "DUNNING_DIA_7" },
    }) });
  });

  it("rejeita item ausente ou não falho", async () => {
    const ausente = banco(null);
    await expect(new ReprocessarNotificacaoBillingService(ausente.db as never).execute("n1", auditoria))
      .rejects.toThrow("NOTIFICACAO_BILLING_NAO_ENCONTRADA");
    const enviada = banco({ id: "n1", status: "ENVIADA", tentativas: 1, tipo: "x", assinatura: { assinanteId: "a1" } });
    await expect(new ReprocessarNotificacaoBillingService(enviada.db as never).execute("n1", auditoria))
      .rejects.toThrow("NOTIFICACAO_BILLING_NAO_ELEGIVEL");
  });

  it("não duplica auditoria quando perde a aquisição concorrente", async () => {
    const { db, tx } = banco({ id: "n1", status: "FALHOU", tentativas: 5, tipo: "x", assinatura: { assinanteId: "a1" } }, 0);
    await expect(new ReprocessarNotificacaoBillingService(db as never).execute("n1", auditoria))
      .resolves.toEqual({ notificacaoId: "n1", duplicado: true });
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
