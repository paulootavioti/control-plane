import { describe, expect, it, vi } from "vitest";

import { ObterResumoFinanceiroService } from "./ObterResumoFinanceiroService";

describe("resumo financeiro do Control Plane", () => {
  it("agrega faturas, consolida indicadores e preenche estados ausentes com zero", async () => {
    const db = { fatura: { groupBy: vi.fn().mockResolvedValue([
      { status: "ABERTA", _count: { _all: 2 }, _sum: { totalCentavos: 30000 } },
      { status: "VENCIDA", _count: { _all: 1 }, _sum: { totalCentavos: 25000 } },
      { status: "PAGA", _count: { _all: 4 }, _sum: { totalCentavos: 80000 } },
      { status: "ESTORNADA", _count: { _all: 1 }, _sum: { totalCentavos: null } },
    ]) } };
    const filtros = {
      assinanteId: "4c73f59b-8151-44d5-b8b5-f8502e1e0ea9",
      competencia: "2026-08",
      vencimentoInicio: new Date("2026-08-01T00:00:00.000Z"),
      vencimentoFim: new Date("2026-08-31T23:59:59.999Z"),
    };

    const resultado = await new ObterResumoFinanceiroService(db as never).execute(filtros);

    expect(db.fatura.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ["status"],
      where: {
        assinanteId: filtros.assinanteId,
        competencia: "2026-08",
        vencimentoEm: { gte: filtros.vencimentoInicio, lte: filtros.vencimentoFim },
      },
      _count: { _all: true },
      _sum: { totalCentavos: true },
    }));
    expect(resultado.indicadores.recebivel).toEqual({ quantidade: 3, totalCentavos: 55000 });
    expect(resultado.indicadores.recebido).toEqual({ quantidade: 4, totalCentavos: 80000 });
    expect(resultado.indicadores.estornado).toEqual({ quantidade: 1, totalCentavos: 0 });
    expect(resultado.porStatus.CANCELADA).toEqual({ quantidade: 0, totalCentavos: 0 });
    expect(resultado.porStatus.RASCUNHO).toEqual({ quantidade: 0, totalCentavos: 0 });
  });

  it("consulta todos os registros quando nenhum filtro é informado", async () => {
    const db = { fatura: { groupBy: vi.fn().mockResolvedValue([]) } };
    const resultado = await new ObterResumoFinanceiroService(db as never).execute({});

    expect(db.fatura.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(resultado.indicadores.recebivel).toEqual({ quantidade: 0, totalCentavos: 0 });
    expect(resultado.filtros).toEqual({
      assinanteId: null, competencia: null, vencimentoInicio: null, vencimentoFim: null,
    });
  });
});
