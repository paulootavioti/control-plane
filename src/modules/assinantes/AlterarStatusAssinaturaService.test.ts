import { describe, expect, it, vi } from "vitest";
import { AlterarStatusAssinaturaService } from "./AlterarStatusAssinaturaService";
const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };

function banco(status = "ATIVA", ambiente: { id: string; status: string } | null = { id: "amb1", status: "ATIVO" }) {
  const tx = {
    assinatura: {
      findUnique: vi.fn().mockResolvedValue({ id: "s1", status, encerradaEm: null }),
      update: vi.fn(),
    },
    ambienteTenant: { findUnique: vi.fn().mockResolvedValue(ambiente), update: vi.fn() },
    assinante: { update: vi.fn() },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("transições da assinatura", () => {
  it("suspende assinatura, assinante e ambiente na mesma transação", async () => {
    const { tx, db } = banco();
    const resultado = await new AlterarStatusAssinaturaService(db as never)
      .execute("a1", "s1", "SUSPENSA", auditoria);
    expect(tx.assinante.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { status: "SUSPENSO" } });
    expect(tx.ambienteTenant.update).toHaveBeenCalledWith({ where: { id: "amb1" }, data: { status: "SUSPENSO" } });
    expect(resultado.exigeEnvioConcessao).toBe(true);
  });

  it("reativa ambiente suspenso e prepara nova concessão", async () => {
    const { tx, db } = banco("SUSPENSA", { id: "amb1", status: "SUSPENSO" });
    const resultado = await new AlterarStatusAssinaturaService(db as never)
      .execute("a1", "s1", "ATIVA", auditoria);
    expect(tx.ambienteTenant.update).toHaveBeenCalledWith({ where: { id: "amb1" }, data: { status: "ATIVO" } });
    expect(resultado.ambienteId).toBe("amb1");
  });

  it("recusa transição a partir de cancelada", async () => {
    const { db } = banco("CANCELADA");
    await expect(new AlterarStatusAssinaturaService(db as never).execute("a1", "s1", "ATIVA", auditoria))
      .rejects.toThrow("TRANSICAO_INVALIDA");
  });

  it("cancela sem encerrar antes da emissão da concessão final", async () => {
    const { tx, db } = banco();
    const agora = new Date("2026-08-12T18:00:00.000Z");
    await new AlterarStatusAssinaturaService(db as never)
      .execute("a1", "s1", "CANCELADA", auditoria, agora);
    expect(tx.assinatura.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "CANCELADA", canceladaEm: agora },
    });
    expect(tx.assinatura.update.mock.calls[0][0].data).not.toHaveProperty("encerradaEm");
    expect(tx.assinante.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { status: "CANCELADO" } });
  });
});
