import { describe, expect, it, vi } from "vitest";
import { ContratarAssinaturaService } from "./ContratarAssinaturaService";

const agora = new Date("2026-08-12T12:00:00.000Z");
const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
function banco(opcoes: { assinante?: unknown; corrente?: unknown; plano?: unknown } = {}) {
  const tx = {
    assinante: { findUnique: vi.fn().mockResolvedValue(opcoes.assinante ?? { status: "PROSPECT" }) },
    assinatura: {
      findFirst: vi.fn().mockResolvedValue(opcoes.corrente ?? null),
      create: vi.fn().mockResolvedValue({ id: "s1", status: "ATIVA", planoVersaoId: "p1", diaVencimento: 10 }),
    },
    planoVersao: { findUnique: vi.fn().mockResolvedValue(opcoes.plano ?? {
      id: "p1", vigenteDesde: new Date("2026-08-01"), vigenteAte: null, plano: { ativo: true },
    }) },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("contratação de assinatura", () => {
  it("cria assinatura corrente sem iniciar provisionamento", async () => {
    const { tx, db } = banco();
    await new ContratarAssinaturaService(db as never).execute("a1", {
      planoVersaoId: "p1", status: "ATIVA", diaVencimento: 10,
    }, auditoria, agora);
    expect(tx.assinatura.create).toHaveBeenCalledOnce();
    expect(tx).not.toHaveProperty("ambienteTenant");
  });

  it("recusa segunda assinatura corrente", async () => {
    const { db } = banco({ corrente: { id: "existente" } });
    await expect(new ContratarAssinaturaService(db as never).execute("a1", {
      planoVersaoId: "p1", status: "ATIVA", diaVencimento: 10,
    }, auditoria, agora)).rejects.toThrow("ASSINATURA_CORRENTE_EXISTE");
  });

  it("exige fim futuro para período de teste", async () => {
    const { db } = banco();
    await expect(new ContratarAssinaturaService(db as never).execute("a1", {
      planoVersaoId: "p1", status: "TESTE", testeAte: agora, diaVencimento: 10,
    }, auditoria, agora)).rejects.toThrow("PERIODO_TESTE_INVALIDO");
  });
});
