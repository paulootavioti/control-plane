import { describe, expect, it, vi } from "vitest";

import { ListarAuditoriaService } from "./ListarAuditoriaService";

describe("consulta da auditoria da plataforma", () => {
  it("aplica filtros e paginação sem selecionar dados sensíveis", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      auditLogPlataforma: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([1, [{ id: "log1", acao: "FATURA_PAGA" }]]),
    };
    const inicio = new Date("2026-08-01T00:00:00.000Z");
    const fim = new Date("2026-08-31T23:59:59.999Z");

    const resultado = await new ListarAuditoriaService(db as never).execute({
      assinanteId: "a1", operadorId: "op1", acao: "FATURA_PAGA",
      alvoTipo: "FATURA", alvoId: "f1", inicio, fim, pagina: 2, limite: 20,
    });

    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 20, total: 1, totalPaginas: 1 });
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({
      assinanteId: "a1", operadorId: "op1", acao: "FATURA_PAGA",
      criadoEm: { gte: inicio, lte: fim },
    }) });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(20);
    expect(consulta.take).toBe(20);
    expect(consulta.select.operador.select).toEqual({ id: true, nome: true, perfil: true });
    expect(consulta.select.operador.select).not.toHaveProperty("email");
    expect(consulta.select.operador.select).not.toHaveProperty("senhaHash");
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
  });
});
