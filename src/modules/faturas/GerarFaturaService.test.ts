import { describe, expect, it, vi } from "vitest";

import { GerarFaturaService, vencimentoDaCompetencia } from "./GerarFaturaService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };

function banco() {
  const tx = {
    assinatura: { findFirst: vi.fn().mockResolvedValue({
      id: "ass1", diaVencimento: 10, politicaCobranca: null,
      alunosPorBlocoNegociado: null, precoPorBlocoCentavosNegociado: 7000,
      blocosMinimosPorUnidadeNegociado: 2,
      planoVersao: {
        id: "pv1", versao: 3, alunosPorBloco: 50, precoPorBlocoCentavos: 8000,
        blocosMinimosPorUnidade: 1, moeda: "BRL", plano: { id: "p1", nome: "Pro" },
      },
    }) },
    snapshotContagem: { findFirst: vi.fn().mockResolvedValue({
      id: "snap1", dataCorte: new Date("2026-08-31T23:00:00.000Z"), itens: [
        { alunosAtivos: 20, licenca: { tenantUnidadeId: "u1", nomeExibicao: "Centro", status: "ATIVA" } },
        { alunosAtivos: 121, licenca: { tenantUnidadeId: "u2", nomeExibicao: "Norte", status: "ATIVA" } },
        { alunosAtivos: 99, licenca: { tenantUnidadeId: "u3", nomeExibicao: "Encerrada", status: "ENCERRADA" } },
      ],
    }) },
    fatura: { create: vi.fn().mockImplementation(({ data }) => ({
      id: "f1", assinanteId: data.assinanteId, assinaturaId: data.assinaturaId,
      competencia: data.competencia, vencimentoEm: data.vencimentoEm,
      status: "RASCUNHO", subtotalCentavos: data.subtotalCentavos,
      totalCentavos: data.totalCentavos, moeda: data.moeda,
    })) },
    auditLogPlataforma: { create: vi.fn() },
  };
  return {
    tx,
    db: {
      fatura: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (operacao) => operacao(tx)),
    },
  };
}

describe("geração de rascunho de fatura", () => {
  it("calcula cada unidade com mínimo e condição negociada", async () => {
    const { tx, db } = banco();

    const resultado = await new GerarFaturaService(db as never).execute("a1", "2026-08", auditoria);

    expect(resultado).toEqual(expect.objectContaining({ id: "f1", totalCentavos: 35000, duplicado: false }));
    const dados = tx.fatura.create.mock.calls[0][0].data;
    expect(dados.itens.create).toEqual([
      expect.objectContaining({ tenantUnidadeId: "u1", blocosCobrados: 2, valorCentavos: 14000 }),
      expect.objectContaining({ tenantUnidadeId: "u2", blocosCobrados: 3, valorCentavos: 21000 }),
    ]);
    expect(dados.condicoesSnapshot).toEqual(expect.objectContaining({ snapshotContagemId: "snap1" }));
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "FATURA_RASCUNHO_GERADA", alvoId: "f1",
      mudancas: { competencia: "2026-08", totalCentavos: 35000, totalItens: 2 },
    }) });
  });

  it("não duplica fatura já existente", async () => {
    const { tx, db } = banco();
    db.fatura.findFirst.mockResolvedValue({ id: "f1", competencia: "2026-08" });

    const resultado = await new GerarFaturaService(db as never).execute("a1", "2026-08", auditoria);

    expect(resultado).toEqual({ id: "f1", competencia: "2026-08", duplicado: true });
    expect(tx.fatura.create).not.toHaveBeenCalled();
  });

  it("recusa cobrança sem contagem da competência", async () => {
    const { tx, db } = banco();
    tx.snapshotContagem.findFirst.mockResolvedValue(null);

    await expect(new GerarFaturaService(db as never).execute("a1", "2026-08", auditoria))
      .rejects.toThrow("SNAPSHOT_NAO_ENCONTRADO");
    expect(tx.fatura.create).not.toHaveBeenCalled();
  });

  it("calcula vencimento em UTC dentro da competência", () => {
    expect(vencimentoDaCompetencia("2026-08", 10).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});
