import { describe, expect, it, vi } from "vitest";

import { ObterPlanoService } from "./ObterPlanoService";

describe("detalhe do plano", () => {
  it("retorna todas as versões com contagens agregadas e seleção sanitizada", async () => {
    const findUnique = vi.fn().mockReturnValue("plano");
    const groupBy = vi.fn().mockReturnValue("correntes");
    const db = {
      plano: { findUnique }, assinatura: { groupBy },
      $transaction: vi.fn().mockResolvedValue([{
        id: "p1", nome: "Pro", versoes: [
          { id: "v2", versao: 2, recursos: { relatorios: true }, _count: { assinaturas: 5 } },
          { id: "v1", versao: 1, recursos: {}, _count: { assinaturas: 8 } },
        ],
      }, [{ planoVersaoId: "v2", _count: { _all: 3 } }]]),
    };

    const resultado = await new ObterPlanoService(db as never).execute("p1");

    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "p1" });
    expect(consulta.select.versoes.orderBy).toEqual({ versao: "desc" });
    expect(consulta.select.versoes.select).not.toHaveProperty("metadadosComerciais");
    expect(consulta.select.versoes.select).not.toHaveProperty("assinaturas");
    expect(groupBy).toHaveBeenCalledWith({
      by: ["planoVersaoId"],
      where: { planoVersao: { planoId: "p1" }, encerradaEm: null },
      _count: { _all: true },
    });
    expect(resultado.versoes).toEqual([
      { id: "v2", versao: 2, recursos: { relatorios: true }, totalAssinaturas: 5, assinaturasCorrentes: 3 },
      { id: "v1", versao: 1, recursos: {}, totalAssinaturas: 8, assinaturasCorrentes: 0 },
    ]);
  });

  it("não revela diferença para plano ausente", async () => {
    const db = {
      $transaction: vi.fn().mockResolvedValue([null, []]),
      plano: { findUnique: vi.fn() },
      assinatura: { groupBy: vi.fn() },
    };
    await expect(new ObterPlanoService(db as never).execute("p1")).rejects.toThrow("PLANO_NAO_ENCONTRADO");
  });
});
