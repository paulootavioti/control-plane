import { describe, expect, it, vi } from "vitest";
import { ReprocessarWebhookBillingService } from "./ReprocessarWebhookBillingService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };

function banco(evento: unknown, adquiridos = 1) {
  const tx = {
    eventoWebhookPagamento: {
      findUnique: vi.fn().mockResolvedValue(evento),
      updateMany: vi.fn().mockResolvedValue({ count: adquiridos }),
    },
    auditLogPlataforma: { create: vi.fn().mockResolvedValue({}) },
  };
  return { db: { $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx) }, tx };
}

describe("reprocessamento manual de webhook", () => {
  it("retoma somente falha e registra auditoria sem payload", async () => {
    const { db, tx } = banco({ id: "ev1", status: "FALHOU", tentativas: 5, tipo: "payment", acao: "updated" });
    await expect(new ReprocessarWebhookBillingService(db as never).execute("ev1", auditoria))
      .resolves.toEqual({ eventoId: "ev1", duplicado: false });
    expect(tx.eventoWebhookPagamento.updateMany).toHaveBeenCalledWith({
      where: { id: "ev1", status: "FALHOU" },
      data: {
        status: "RECEBIDO", tentativas: 0, erroSanitizado: null,
        processamentoIniciadoEm: null, processadoEm: null,
      },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "BILLING_WEBHOOK_REPROCESSADO", alvoId: "ev1",
      mudancas: { tentativasAnteriores: 5, tipo: "payment", acao: "updated" },
    }) });
    expect(JSON.stringify(tx.auditLogPlataforma.create.mock.calls)).not.toContain("payloadBruto");
  });

  it("rejeita item ausente ou fora do estado falho", async () => {
    const ausente = banco(null);
    await expect(new ReprocessarWebhookBillingService(ausente.db as never).execute("ev1", auditoria))
      .rejects.toThrow("EVENTO_WEBHOOK_NAO_ENCONTRADO");
    const processado = banco({ id: "ev1", status: "PROCESSADO", tentativas: 1, tipo: "x", acao: "y" });
    await expect(new ReprocessarWebhookBillingService(processado.db as never).execute("ev1", auditoria))
      .rejects.toThrow("EVENTO_WEBHOOK_NAO_ELEGIVEL");
  });

  it("trata aquisição concorrente como duplicada e não audita", async () => {
    const { db, tx } = banco({ id: "ev1", status: "FALHOU", tentativas: 5, tipo: "x", acao: "y" }, 0);
    await expect(new ReprocessarWebhookBillingService(db as never).execute("ev1", auditoria))
      .resolves.toEqual({ eventoId: "ev1", duplicado: true });
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
