import { describe, expect, it, vi } from "vitest";

import { RetomarProvisionamentoService } from "./RetomarProvisionamentoService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };

function banco(status = "FALHOU", tentativas = 5, assinatura: { id: string } | null = { id: "ass1" }) {
  const tx = {
    eventoProvisionamento: {
      findUnique: vi.fn().mockResolvedValue({
        id: "ev1", status, tentativas, etapaAtual: "MIGRATIONS_APLICADAS",
        ambiente: { id: "amb1", assinanteId: "a1" },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    assinatura: { findFirst: vi.fn().mockResolvedValue(assinatura) },
    ambienteTenant: { update: vi.fn() },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("retomada manual do provisionamento", () => {
  it("reabre o mesmo evento a partir da última etapa confirmada", async () => {
    const { tx, db } = banco();

    const resultado = await new RetomarProvisionamentoService(db as never).execute("ev1", auditoria);

    expect(resultado).toEqual({ eventoId: "ev1", ambienteId: "amb1", duplicado: false });
    expect(tx.eventoProvisionamento.updateMany).toHaveBeenCalledWith({
      where: { id: "ev1", status: "FALHOU", tentativas: { gte: 5 } },
      data: {
        status: "PENDENTE", tentativas: 0, erroSanitizado: null,
        iniciadoEm: null, concluidoEm: null, proximaTentativaEm: null,
      },
    });
    expect(tx.ambienteTenant.update).toHaveBeenCalledWith({
      where: { id: "amb1" },
      data: { status: "PENDENTE", assinante: { update: { status: "EM_PROVISIONAMENTO" } } },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "PROVISIONAMENTO_RETOMADO",
      alvoId: "ev1",
      mudancas: { assinaturaId: "ass1", retomadaDeEtapa: "MIGRATIONS_APLICADAS" },
    }) });
  });

  it("é idempotente se o evento já voltou para a fila", async () => {
    const { tx, db } = banco("PENDENTE", 0);

    const resultado = await new RetomarProvisionamentoService(db as never).execute("ev1", auditoria);

    expect(resultado.duplicado).toBe(true);
    expect(tx.eventoProvisionamento.updateMany).not.toHaveBeenCalled();
  });

  it("recusa intervenção antes do esgotamento das retentativas automáticas", async () => {
    const { tx, db } = banco("FALHOU", 3);

    await expect(new RetomarProvisionamentoService(db as never).execute("ev1", auditoria))
      .rejects.toThrow("EVENTO_NAO_ELEGIVEL");
    expect(tx.eventoProvisionamento.updateMany).not.toHaveBeenCalled();
  });

  it("recusa retomada sem assinatura comercial elegível", async () => {
    const { tx, db } = banco("FALHOU", 5, null);

    await expect(new RetomarProvisionamentoService(db as never).execute("ev1", auditoria))
      .rejects.toThrow("ASSINATURA_NAO_ELEGIVEL");
    expect(tx.eventoProvisionamento.updateMany).not.toHaveBeenCalled();
  });

  it("devolve idempotência quando outra requisição adquire o evento", async () => {
    const { tx, db } = banco();
    tx.eventoProvisionamento.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await new RetomarProvisionamentoService(db as never).execute("ev1", auditoria);

    expect(resultado.duplicado).toBe(true);
    expect(tx.ambienteTenant.update).not.toHaveBeenCalled();
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
