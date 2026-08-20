import { describe, expect, it, vi } from "vitest";
import { ListarAssinaturasService } from "./ListarAssinaturasService";

describe("inventário global de assinaturas", () => {
  it("filtra, pagina e retorna somente dados comerciais sanitizados", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = { assinatura: { count, findMany }, $transaction: vi.fn().mockResolvedValue([11, [{
      id: "s1", status: "TESTE",
      assinante: { id: "a1", nomeFantasia: "Academia Centro", slug: "centro", status: "ATIVO" },
      planoVersao: { id: "pv1", versao: 2, plano: { id: "p1", nome: "Pro" } }, _count: { faturas: 4 },
    }]]) };
    const testeAteInicio = new Date("2026-08-01T00:00:00.000Z");
    const testeAteFim = new Date("2026-08-31T23:59:59.000Z");
    const encerradaInicio = new Date("2026-07-01T00:00:00.000Z");
    const resultado = await new ListarAssinaturasService(db as never).execute({
      assinanteId: "a1", status: "TESTE", planoId: "p1", busca: "centro",
      testeAteInicio, testeAteFim, encerradaInicio, pagina: 2, limite: 5,
    });
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({
      assinanteId: "a1", status: "TESTE", planoVersao: { planoId: "p1" },
      testeAte: { gte: testeAteInicio, lte: testeAteFim }, encerradaEm: { gte: encerradaInicio },
    }) });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
    const selecao = findMany.mock.calls[0][0].select;
    expect(selecao.assinante.select).toEqual({ id: true, nomeFantasia: true, slug: true, status: true });
    expect(selecao).not.toHaveProperty("politicaCobranca");
    expect(selecao.assinante.select).not.toHaveProperty("documento");
    expect(selecao.assinante.select).not.toHaveProperty("emailCobranca");
    expect(resultado.itens[0]).toEqual({ id: "s1", status: "TESTE",
      assinante: { id: "a1", nomeFantasia: "Academia Centro", slug: "centro", status: "ATIVO" },
      planoVersao: { id: "pv1", versao: 2, plano: { id: "p1", nome: "Pro" } }, totalFaturas: 4 });
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 5, total: 11, totalPaginas: 3 });
  });
});
