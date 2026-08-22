import { describe, expect, it, vi } from "vitest";
import { executarCicloBillingRegistrado } from "./executarCicloBillingRegistrado";

function banco() {
  const execucaoWorkerBilling = {
    create: vi.fn().mockResolvedValue({ id: "e1" }),
    update: vi.fn().mockResolvedValue({}),
  };
  const db = {
    execucaoWorkerBilling,
    eventoWebhookPagamento: { findFirst: vi.fn().mockResolvedValue(null) },
    tentativaDunning: { findFirst: vi.fn().mockResolvedValue(null) },
    assinatura: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db, execucaoWorkerBilling };
}

describe("histórico do ciclo de billing", () => {
  it("registra ciclo concluído com sucesso", async () => {
    const { db, execucaoWorkerBilling } = banco();
    await expect(executarCicloBillingRegistrado(db as never, { obterAssinatura: vi.fn() } as never, 7))
      .resolves.toEqual({ eventos: 0, dunning: 0, reconciliacoes: 0, notificacoes: 0, falhas: 0 });
    expect(execucaoWorkerBilling.create).toHaveBeenCalledWith({ data: { limite: 7 }, select: { id: true } });
    expect(execucaoWorkerBilling.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: expect.objectContaining({
      status: "SUCESSO", eventos: 0, falhas: 0, concluidoEm: expect.any(Date),
    }) });
  });

  it("registra falha fatal sem URL ou e-mail", async () => {
    const { db, execucaoWorkerBilling } = banco();
    db.assinatura.findMany.mockRejectedValue(new Error("falhou https://interno/x para pessoa@example.com"));
    await expect(executarCicloBillingRegistrado(db as never, { obterAssinatura: vi.fn() } as never, 3))
      .rejects.toThrow("falhou");
    expect(execucaoWorkerBilling.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: {
      status: "FALHOU", falhas: 1, erroSanitizado: "falhou [url] para [email]", concluidoEm: expect.any(Date),
    } });
  });
});
