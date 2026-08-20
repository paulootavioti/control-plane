import { describe, expect, it, vi } from "vitest";

import { ObterFaturaService } from "./ObterFaturaService";

describe("detalhe administrativo da fatura", () => {
  it("retorna memória congelada e itens agregados por unidade", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "f1",
      competencia: "2026-08",
      planoSnapshot: { planoNome: "Pro", versao: 3 },
      condicoesSnapshot: { snapshotContagemId: "snap1", alunosPorBloco: 50 },
      assinante: { nomeFantasia: "Academia Centro", slug: "academia-centro" },
      itens: [
        { tenantUnidadeId: "u1", nomeUnidade: "Centro", alunosAtivos: 20, blocosCobrados: 2 },
        { tenantUnidadeId: "u2", nomeUnidade: "Norte", alunosAtivos: 121, blocosCobrados: 3 },
      ],
    });

    const resultado = await new ObterFaturaService({ fatura: { findUnique } } as never).execute("f1");

    expect(resultado.totalItens).toBe(2);
    expect(resultado.itens).toHaveLength(2);
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.select).not.toHaveProperty("assinatura");
    expect(consulta.select.assinante.select).toEqual({ nomeFantasia: true, slug: true });
    expect(consulta.select.itens.select).not.toHaveProperty("alunoId");
  });

  it("distingue fatura inexistente", async () => {
    const db = { fatura: { findUnique: vi.fn().mockResolvedValue(null) } };

    await expect(new ObterFaturaService(db as never).execute("f1"))
      .rejects.toThrow("FATURA_NAO_ENCONTRADA");
  });
});
