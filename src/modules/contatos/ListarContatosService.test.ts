import { describe, expect, it, vi } from "vitest";

import { ListarContatosService } from "./ListarContatosService";

describe("listagem global de contatos comerciais", () => {
  it("filtra, pagina e seleciona somente o assinante mínimo", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const itens = [{
      id: "c1", nome: "Maria", email: "maria@example.com", telefone: "11999999999",
      tipo: "FINANCEIRO", principal: true,
      assinante: { id: "a1", nomeFantasia: "Academia Centro", slug: "centro", status: "ATIVO" },
    }];
    const db = {
      contatoAssinante: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([13, itens]),
    };

    const resultado = await new ListarContatosService(db as never).execute({
      assinanteId: "a1", tipo: "FINANCEIRO", principal: true,
      busca: "maria", pagina: 2, limite: 5,
    });

    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({
      assinanteId: "a1", tipo: "FINANCEIRO", principal: true,
      OR: expect.arrayContaining([
        { nome: { contains: "maria", mode: "insensitive" } },
        { email: { contains: "maria", mode: "insensitive" } },
        { telefone: { contains: "maria" } },
      ]),
    }) });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
    const assinanteSelect = findMany.mock.calls[0][0].select.assinante.select;
    expect(assinanteSelect).toEqual({ id: true, nomeFantasia: true, slug: true, status: true });
    expect(assinanteSelect).not.toHaveProperty("documento");
    expect(assinanteSelect).not.toHaveProperty("emailCobranca");
    expect(resultado).toEqual({
      itens,
      paginacao: { pagina: 2, limite: 5, total: 13, totalPaginas: 3 },
    });
  });
});
