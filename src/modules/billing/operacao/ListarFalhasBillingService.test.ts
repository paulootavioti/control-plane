import { describe, expect, it, vi } from "vitest";
import { ListarFalhasBillingService } from "./ListarFalhasBillingService";

describe("listagem operacional de falhas do billing", () => {
  it("limita e seleciona somente campos operacionais sanitizados", async () => {
    const db = {
      eventoWebhookPagamento: { findMany: vi.fn().mockResolvedValue([]) },
      tentativaDunning: { findMany: vi.fn().mockResolvedValue([]) },
      notificacaoBilling: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(new ListarFalhasBillingService(db as never).execute(15))
      .resolves.toEqual({ webhooks: [], dunning: [], notificacoes: [], limite: 15 });

    const webhookQuery = db.eventoWebhookPagamento.findMany.mock.calls[0][0];
    const notificacaoQuery = db.notificacaoBilling.findMany.mock.calls[0][0];
    const dunningQuery = db.tentativaDunning.findMany.mock.calls[0][0];
    expect(webhookQuery).toMatchObject({ where: { status: "FALHOU" }, take: 15 });
    expect(notificacaoQuery).toMatchObject({ where: { status: "FALHOU" }, take: 15 });
    expect(dunningQuery).toMatchObject({ where: { status: "FALHOU" }, take: 15 });
    expect(webhookQuery.select).not.toHaveProperty("payloadBruto");
    expect(webhookQuery.select).not.toHaveProperty("eventoExternoId");
    expect(notificacaoQuery.select).not.toHaveProperty("destinatario");
    expect(notificacaoQuery.select).not.toHaveProperty("dados");
    expect(dunningQuery.select.assinatura.select).not.toHaveProperty("planoSnapshot");
  });
});
