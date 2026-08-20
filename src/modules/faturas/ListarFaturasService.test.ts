import { describe, expect, it, vi } from "vitest";

import { ListarFaturasService } from "./ListarFaturasService";

describe("listagem financeira de faturas", () => {
  it("aplica filtros, pagina e retorna somente o resumo da cobrança", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      fatura: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([21, [{
        id: "f1", competencia: "2026-08", totalCentavos: 15000,
        assinante: { id: "a1", nomeFantasia: "Academia Centro" },
        _count: { itens: 3 },
      }]]),
    };
    const vencimentoInicio = new Date("2026-08-01T00:00:00.000Z");
    const vencimentoFim = new Date("2026-08-31T23:59:59.999Z");

    const resultado = await new ListarFaturasService(db as never).execute({
      assinanteId: "a1",
      status: "ABERTA",
      competencia: "2026-08",
      vencimentoInicio,
      vencimentoFim,
      pagina: 2,
      limite: 10,
    });

    expect(count).toHaveBeenCalledWith({ where: {
      assinanteId: "a1",
      status: "ABERTA",
      competencia: "2026-08",
      vencimentoEm: { gte: vencimentoInicio, lte: vencimentoFim },
    } });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(10);
    expect(consulta.take).toBe(10);
    expect(consulta.select).not.toHaveProperty("planoSnapshot");
    expect(consulta.select).not.toHaveProperty("condicoesSnapshot");
    expect(consulta.select).not.toHaveProperty("gatewayFaturaId");
    expect(resultado.itens[0]).toEqual({
      id: "f1",
      competencia: "2026-08",
      totalCentavos: 15000,
      assinante: { id: "a1", nomeFantasia: "Academia Centro" },
      totalItens: 3,
    });
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 10, total: 21, totalPaginas: 3 });
  });
});
