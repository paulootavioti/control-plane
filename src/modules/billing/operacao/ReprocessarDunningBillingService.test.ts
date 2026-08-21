import { describe, expect, it, vi } from "vitest";
import { ReprocessarDunningBillingService } from "./ReprocessarDunningBillingService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const falha = { id: "d1", status: "FALHOU", diaRegua: 7, acao: "NOTIFICAR", assinatura: { id: "s1", assinanteId: "a1", status: "INADIMPLENTE" } };

function banco(tentativa: unknown, adquiridos = 1) {
  const tx = {
    tentativaDunning: { findUnique: vi.fn().mockResolvedValue(tentativa), updateMany: vi.fn().mockResolvedValue({ count: adquiridos }) },
    auditLogPlataforma: { create: vi.fn().mockResolvedValue({}) },
  };
  return { db: { $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx) }, tx };
}

describe("retomada manual de dunning", () => {
  it("reagenda falha imediatamente e audita sem dados clínicos", async () => {
    const agora = new Date("2026-08-21T18:00:00Z");
    const { db, tx } = banco(falha);
    await expect(new ReprocessarDunningBillingService(db as never).execute("d1", auditoria, agora))
      .resolves.toEqual({ tentativaId: "d1", duplicado: false });
    expect(tx.tentativaDunning.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "FALHOU" },
      data: { status: "PENDENTE", agendadaPara: agora, executadaEm: null, execucaoIniciadaEm: null, erroSanitizado: null },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      assinanteId: "a1", acao: "BILLING_DUNNING_REPROCESSADO", alvoId: "d1",
      mudancas: { assinaturaId: "s1", diaRegua: 7, acao: "NOTIFICAR" },
    }) });
  });

  it("rejeita item ausente, não falho ou de assinatura encerrada", async () => {
    await expect(new ReprocessarDunningBillingService(banco(null).db as never).execute("d1", auditoria))
      .rejects.toThrow("TENTATIVA_DUNNING_NAO_ENCONTRADA");
    await expect(new ReprocessarDunningBillingService(banco({ ...falha, status: "EXECUTADA" }).db as never).execute("d1", auditoria))
      .rejects.toThrow("TENTATIVA_DUNNING_NAO_ELEGIVEL");
    await expect(new ReprocessarDunningBillingService(banco({ ...falha, assinatura: { ...falha.assinatura, status: "ENCERRADA" } }).db as never).execute("d1", auditoria))
      .rejects.toThrow("ASSINATURA_NAO_ELEGIVEL");
  });

  it("não duplica auditoria quando perde aquisição concorrente", async () => {
    const { db, tx } = banco(falha, 0);
    await expect(new ReprocessarDunningBillingService(db as never).execute("d1", auditoria))
      .resolves.toEqual({ tentativaId: "d1", duplicado: true });
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
