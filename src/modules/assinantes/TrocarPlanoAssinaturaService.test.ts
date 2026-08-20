import { describe, expect, it, vi } from "vitest";

import { TrocarPlanoAssinaturaService } from "./TrocarPlanoAssinaturaService";

const agora = new Date("2027-01-01T00:00:00.000Z");
const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: "127.0.0.1", userAgent: "teste" };

function banco() {
  const atual = {
    id: "a1", planoVersaoId: "pv1", status: "ATIVA", inicioEm: new Date("2026-01-01"),
    testeAte: null, canceladaEm: null, encerradaEm: null, diaVencimento: 10,
    alunosPorBlocoNegociado: 120, precoPorBlocoCentavosNegociado: 20000,
    blocosMinimosPorUnidadeNegociado: 2, politicaCobranca: { multa: 2 },
    planoVersao: { planoId: "p1" },
  };
  const nova = { id: "a2", assinanteId: "c1", planoVersaoId: "pv2", status: "ATIVA", inicioEm: agora, testeAte: null, diaVencimento: 10 };
  const tx = {
    assinante: { findUnique: vi.fn().mockResolvedValue({ id: "c1" }) },
    planoVersao: { findFirst: vi.fn().mockResolvedValue({ id: "pv2", planoId: "p2", versao: 3 }) },
    assinatura: {
      findUnique: vi.fn().mockResolvedValue(atual), findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(), create: vi.fn().mockResolvedValue(nova),
    },
    auditLogPlataforma: { create: vi.fn() },
  };
  const transaction = vi.fn(async (operacao) => operacao(tx));
  return { db: { $transaction: transaction }, tx, transaction, atual, nova };
}

describe("troca de plano da assinatura", () => {
  it("encerra a assinatura antiga e cria outra preservando suas condições", async () => {
    const { db, tx, transaction } = banco();
    const resultado = await new TrocarPlanoAssinaturaService(db as never)
      .execute("c1", "a1", "p2", auditoria, agora);

    expect(resultado).toMatchObject({ assinaturaAnteriorId: "a1", assinatura: { id: "a2" }, alterada: true });
    expect(tx.assinatura.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { encerradaEm: agora } });
    expect(tx.assinatura.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      planoVersaoId: "pv2", status: "ATIVA", diaVencimento: 10,
      alunosPorBlocoNegociado: 120, precoPorBlocoCentavosNegociado: 20000,
      blocosMinimosPorUnidadeNegociado: 2, politicaCobranca: { multa: 2 },
    }) }));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("seleciona somente versão vigente de plano ativo", async () => {
    const { db, tx } = banco();
    await new TrocarPlanoAssinaturaService(db as never).execute("c1", "a1", "p2", auditoria, agora);
    expect(tx.planoVersao.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      planoId: "p2", vigenteDesde: { lte: agora },
      OR: [{ vigenteAte: null }, { vigenteAte: { gt: agora } }], plano: { ativo: true },
    } }));
  });

  it("é idempotente quando a troca solicitada já gerou a sucessora", async () => {
    const { db, tx, atual, nova } = banco();
    tx.assinatura.findUnique.mockResolvedValue({ ...atual, encerradaEm: agora });
    tx.assinatura.findFirst.mockResolvedValue(nova);
    const resultado = await new TrocarPlanoAssinaturaService(db as never).execute("c1", "a1", "p2", auditoria, agora);
    expect(resultado.alterada).toBe(false);
    expect(tx.assinatura.create).not.toHaveBeenCalled();
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });

  it("não troca assinatura cancelada nem para o mesmo plano", async () => {
    const primeiro = banco();
    primeiro.tx.assinatura.findUnique.mockResolvedValue({ ...primeiro.atual, status: "CANCELADA" });
    await expect(new TrocarPlanoAssinaturaService(primeiro.db as never).execute("c1", "a1", "p2", auditoria, agora))
      .rejects.toThrow("ASSINATURA_NAO_ELEGIVEL");

    const segundo = banco();
    await expect(new TrocarPlanoAssinaturaService(segundo.db as never).execute("c1", "a1", "p1", auditoria, agora))
      .rejects.toThrow("PLANO_JA_APLICADO");
  });

  it("audita apenas referências e condições conhecidas", async () => {
    const { db, tx } = banco();
    await new TrocarPlanoAssinaturaService(db as never).execute("c1", "a1", "p2", auditoria, agora);
    const registro = tx.auditLogPlataforma.create.mock.calls[0][0];
    expect(registro).toEqual({ data: expect.objectContaining({ acao: "ASSINATURA_PLANO_ALTERADO", alvoId: "a2" }) });
    expect(JSON.stringify(registro)).not.toContain("multa");
  });
});
