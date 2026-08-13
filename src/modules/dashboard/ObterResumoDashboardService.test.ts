import { describe, expect, it, vi } from "vitest";

import { ObterResumoDashboardService } from "./ObterResumoDashboardService";

describe("resumo executivo do Control Plane", () => {
  it("agrega todos os estados e preenche estados sem registros com zero", async () => {
    const db = {
      assinante: { groupBy: vi.fn().mockResolvedValue([{ status: "ATIVO", _count: { _all: 4 } }]) },
      ambienteTenant: { groupBy: vi.fn().mockResolvedValue([{ status: "FALHOU", _count: { _all: 2 } }]) },
      licencaUnidade: { groupBy: vi.fn().mockResolvedValue([{ status: "ATIVA", _count: { _all: 7 } }]) },
      fatura: { groupBy: vi.fn().mockResolvedValue([
        { status: "ABERTA", _count: { _all: 3 }, _sum: { totalCentavos: 45000 } },
      ]) },
    };

    const resultado = await new ObterResumoDashboardService(db as never).execute();

    expect(resultado.assinantes.ATIVO).toBe(4);
    expect(resultado.assinantes.PROSPECT).toBe(0);
    expect(resultado.ambientes.FALHOU).toBe(2);
    expect(resultado.ambientes.ATIVO).toBe(0);
    expect(resultado.licencas.ATIVA).toBe(7);
    expect(resultado.licencas.ENCERRADA).toBe(0);
    expect(resultado.faturas.ABERTA).toEqual({ quantidade: 3, totalCentavos: 45000 });
    expect(resultado.faturas.VENCIDA).toEqual({ quantidade: 0, totalCentavos: 0 });
    expect(db.fatura.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: { _all: true },
      _sum: { totalCentavos: true },
    });
  });
});
