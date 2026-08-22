import { describe, expect, it, vi } from "vitest";
import { EntregarNotificacoesBillingService } from "./EntregarNotificacoesBillingService";

function banco(candidata: unknown, tentativas = 1, adquiridas = 1) {
  const notificacaoBilling = {
    findFirst: vi.fn().mockResolvedValue(candidata),
    updateMany: vi.fn().mockResolvedValue({ count: adquiridas }),
    findUniqueOrThrow: vi.fn().mockResolvedValue({
      id: "n1", chaveIdempotencia: "s1:DUNNING:d7", tipo: "DUNNING",
      destinatario: "financeiro@example.com", dados: { diaRegua: 7 }, tentativas,
    }),
    update: vi.fn().mockResolvedValue({}),
  };
  return { db: { notificacaoBilling }, notificacaoBilling };
}

describe("entrega da outbox de billing", () => {
  const agora = new Date("2026-08-22T01:00:00Z");

  it("encerra sem transporte quando não existe item elegível", async () => {
    const { db } = banco(null);
    const transportador = { enviar: vi.fn() };
    await expect(new EntregarNotificacoesBillingService(db as never, transportador).executarProxima(agora))
      .resolves.toBe("VAZIO");
    expect(transportador.enviar).not.toHaveBeenCalled();
  });

  it("adquire, envia e conclui uma notificação", async () => {
    const { db, notificacaoBilling } = banco({ id: "n1", status: "PENDENTE" });
    const transportador = { enviar: vi.fn().mockResolvedValue(undefined) };
    await expect(new EntregarNotificacoesBillingService(db as never, transportador).executarProxima(agora))
      .resolves.toBe("ENVIADA");
    expect(notificacaoBilling.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "PROCESSANDO", processamentoIniciadoEm: agora, tentativas: { increment: 1 } },
    }));
    expect(transportador.enviar).toHaveBeenCalledWith(expect.objectContaining({ chaveIdempotencia: "s1:DUNNING:d7" }));
    expect(notificacaoBilling.update).toHaveBeenLastCalledWith({
      where: { id: "n1" },
      data: { status: "ENVIADA", enviadaEm: agora, processamentoIniciadoEm: null, erroSanitizado: null },
    });
  });

  it("não entrega quando perde a aquisição concorrente", async () => {
    const { db } = banco({ id: "n1", status: "PENDENTE" }, 1, 0);
    const transportador = { enviar: vi.fn() };
    await expect(new EntregarNotificacoesBillingService(db as never, transportador).executarProxima(agora))
      .resolves.toBe("VAZIO");
    expect(transportador.enviar).not.toHaveBeenCalled();
  });

  it("reagenda com backoff e sanitiza detalhes sensíveis", async () => {
    const { db, notificacaoBilling } = banco({ id: "n1", status: "PENDENTE" }, 2);
    const transportador = { enviar: vi.fn().mockRejectedValue(new Error("falha https://interno/x para pessoa@example.com")) };
    await expect(new EntregarNotificacoesBillingService(db as never, transportador).executarProxima(agora))
      .resolves.toBe("REAGENDADA");
    expect(notificacaoBilling.update).toHaveBeenLastCalledWith({ where: { id: "n1" }, data: {
      status: "PENDENTE", processamentoIniciadoEm: null,
      proximaTentativaEm: new Date("2026-08-22T01:30:00Z"),
      erroSanitizado: "falha [url] para [email]",
    } });
  });

  it("marca falha definitiva na quinta tentativa", async () => {
    const { db, notificacaoBilling } = banco({ id: "n1", status: "PROCESSANDO" }, 5);
    const transportador = { enviar: vi.fn().mockRejectedValue(new Error("indisponível")) };
    await expect(new EntregarNotificacoesBillingService(db as never, transportador).executarProxima(agora))
      .resolves.toBe("FALHOU");
    expect(notificacaoBilling.update).toHaveBeenLastCalledWith({ where: { id: "n1" }, data: {
      status: "FALHOU", processamentoIniciadoEm: null, proximaTentativaEm: agora, erroSanitizado: "indisponível",
    } });
  });
});
