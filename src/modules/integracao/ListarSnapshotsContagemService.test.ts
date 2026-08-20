import { describe, expect, it, vi } from "vitest";

import { ListarSnapshotsContagemService } from "./ListarSnapshotsContagemService";

describe("consulta dos snapshots agregados de contagem", () => {
  it("aplica filtros e paginação sem selecionar alunos ou credenciais", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      snapshotContagem: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([1, [{
        id: "snap1",
        versaoContrato: 1,
        dataCorte: new Date("2026-08-10T00:00:00.000Z"),
        recebidoEm: new Date("2026-08-10T01:00:00.000Z"),
        assinante: { id: "a1", nomeFantasia: "Academia", slug: "academia" },
        itens: [{
          alunosAtivos: 27,
          licenca: { id: "l1", tenantUnidadeId: "u1", nomeExibicao: "Centro", status: "ATIVA" },
        }],
      }]]),
    };
    const inicio = new Date("2026-08-01T00:00:00.000Z");
    const fim = new Date("2026-08-31T23:59:59.999Z");

    const resultado = await new ListarSnapshotsContagemService(db as never).execute({
      assinanteId: "a1", dataCorteInicio: inicio, dataCorteFim: fim, pagina: 2, limite: 10,
    });

    expect(count).toHaveBeenCalledWith({ where: {
      assinanteId: "a1", dataCorte: { gte: inicio, lte: fim },
    } });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(10);
    expect(consulta.take).toBe(10);
    expect(consulta.select.assinante.select).toEqual({ id: true, nomeFantasia: true, slug: true });
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(consulta.select.itens.select).toEqual({
      alunosAtivos: true,
      licenca: { select: { id: true, tenantUnidadeId: true, nomeExibicao: true, status: true } },
    });
    expect(resultado.itens[0].itens).toEqual([{
      licencaId: "l1", unidadeId: "u1", unidadeNome: "Centro", statusLicenca: "ATIVA", alunosAtivos: 27,
    }]);
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 10, total: 1, totalPaginas: 1 });
  });
});
