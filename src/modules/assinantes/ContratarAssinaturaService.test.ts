import { describe, expect, it, vi } from "vitest";
import { ContratarAssinaturaService } from "./ContratarAssinaturaService";

const agora = new Date("2026-08-12T12:00:00.000Z");
const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
function banco(opcoes: { assinante?: unknown; corrente?: unknown; plano?: unknown } = {}) {
  const tx = {
    assinante: { findUnique: vi.fn().mockResolvedValue(opcoes.assinante ?? { status: "PROSPECT", produtoCodigo: "sysbelt" }), update: vi.fn() },
    assinatura: {
      findFirst: vi.fn().mockResolvedValue(opcoes.corrente ?? null),
      create: vi.fn().mockResolvedValue({ id: "s1", status: "ATIVA", planoVersaoId: "p1", diaVencimento: 10 }),
    },
    planoVersao: { findUnique: vi.fn().mockResolvedValue(opcoes.plano ?? {
      id: "p1", vigenteDesde: new Date("2026-08-01"), vigenteAte: null, plano: { ativo: true, produtoCodigo: "sysbelt" },
    }) },
    ambienteTenant: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "amb1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "latest", eventos: [{ id: "ev1" }] }) },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("contratação de assinatura", () => {
  it("cria assinatura corrente e enfileira provisionamento na mesma transação", async () => {
    const { tx, db } = banco();
    await new ContratarAssinaturaService(db as never).execute("a1", {
      planoVersaoId: "p1", status: "ATIVA", diaVencimento: 10,
    }, auditoria, agora);
    expect(tx.assinatura.create).toHaveBeenCalledOnce();
    expect(tx.ambienteTenant.create).toHaveBeenCalledOnce();
    expect(tx.assinante.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EM_PROVISIONAMENTO" } }));
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

  it("isola produtos na contratação", async () => {
    const { db } = banco({ plano: { id: "p1", vigenteDesde: new Date("2026-08-01"), vigenteAte: null,
      plano: { ativo: true, produtoCodigo: "psyche" } } });
    await expect(new ContratarAssinaturaService(db as never).execute("a1", {
      planoVersaoId: "p1", status: "ATIVA", diaVencimento: 10,
    }, auditoria, agora)).rejects.toThrow("PLANO_PRODUTO_DIVERGENTE");
  });
});
