import { describe, expect, it, vi } from "vitest";

import { ListarLicencasUnidadeService } from "./ListarLicencasUnidadeService";

describe("inventário global de licenças por unidade", () => {
  it("aplica filtros e retorna somente dados comerciais mínimos", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const item = {
      id: "l1", tenantUnidadeId: "u1", nomeExibicao: "Centro", status: "ATIVA",
      inicioCobrancaEm: new Date("2026-08-01T00:00:00.000Z"), encerramentoCobrancaEm: null,
      ultimaSincronizacaoEm: new Date("2026-08-12T00:00:00.000Z"),
      assinante: { id: "a1", nomeFantasia: "Academia", slug: "academia", status: "ATIVA" },
    };
    const db = {
      licencaUnidade: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([1, [item]]),
    };
    const inicio = new Date("2026-08-01T00:00:00.000Z");
    const fim = new Date("2026-08-31T23:59:59.999Z");

    const resultado = await new ListarLicencasUnidadeService(db as never).execute({
      assinanteId: "a1", status: "ATIVA", busca: "centro",
      sincronizadaInicio: inicio, sincronizadaFim: fim, pagina: 2, limite: 10,
    });

    expect(count).toHaveBeenCalledWith({ where: {
      assinanteId: "a1", status: "ATIVA",
      AND: [{ OR: [
          { nomeExibicao: { contains: "centro", mode: "insensitive" } },
          { tenantUnidadeId: { contains: "centro", mode: "insensitive" } },
      ] }],
      ultimaSincronizacaoEm: { gte: inicio, lte: fim },
    } });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(10);
    expect(consulta.take).toBe(10);
    expect(consulta.select.assinante.select).toEqual({
      id: true, nomeFantasia: true, slug: true, status: true,
    });
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(consulta.select).not.toHaveProperty("contagens");
    expect(resultado).toEqual({
      itens: [item], paginacao: { pagina: 2, limite: 10, total: 1, totalPaginas: 1 },
    });
  });

  it("inclui licenças nunca sincronizadas no filtro de desatualização", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      licencaUnidade: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([0, []]),
    };
    const antes = new Date("2026-08-01T00:00:00.000Z");

    await new ListarLicencasUnidadeService(db as never).execute({
      desatualizadaAntes: antes, pagina: 1, limite: 20,
    });

    expect(count).toHaveBeenCalledWith({ where: { AND: [{ OR: [
      { ultimaSincronizacaoEm: null }, { ultimaSincronizacaoEm: { lt: antes } },
    ] }] } });
  });
});
