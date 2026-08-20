import { describe, expect, it, vi } from "vitest";

import { ListarAssinantesService } from "./ListarAssinantesService";

describe("listagem administrativa de assinantes", () => {
  it("filtra, pagina e achata somente a assinatura corrente", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      assinante: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([12, [{
        id: "a1", nomeFantasia: "Academia Centro", assinaturas: [{ id: "s1" }],
        _count: { licencas: 3 },
      }]]),
    };

    const resultado = await new ListarAssinantesService(db as never).execute({
      busca: "centro", status: "ATIVO", pagina: 2, limite: 5,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ status: "ATIVO" }) });
    expect(resultado.itens[0]).toEqual({
      id: "a1", nomeFantasia: "Academia Centro", assinatura: { id: "s1" }, totalLicencas: 3,
    });
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 5, total: 12, totalPaginas: 3 });
  });
});
