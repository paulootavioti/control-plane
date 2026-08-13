import { describe, expect, it, vi } from "vitest";

import { ListarOperadoresService } from "./ListarOperadoresService";

describe("listagem administrativa de operadores", () => {
  it("filtra e pagina sem selecionar credenciais ou versão de sessão", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      operadorPlataforma: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([6, [{ id: "op1", nome: "Suporte" }]]),
    };

    const resultado = await new ListarOperadoresService(db as never).execute({
      busca: "suporte",
      perfil: "SUPORTE",
      ativo: false,
      pagina: 2,
      limite: 5,
    });

    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ perfil: "SUPORTE", ativo: false }) });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(5);
    expect(consulta.take).toBe(5);
    expect(consulta.select).not.toHaveProperty("senhaHash");
    expect(consulta.select).not.toHaveProperty("versaoToken");
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 5, total: 6, totalPaginas: 2 });
  });
});
