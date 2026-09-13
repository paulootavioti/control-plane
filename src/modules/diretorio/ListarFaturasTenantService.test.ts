import { describe, expect, it, vi } from "vitest";
import { ListarFaturasTenantService } from "./ListarFaturasTenantService";

describe("faturas projetadas para o tenant", () => {
  it("resolve o assinante pelo produto e slug e retorna somente sua memória resumida", async () => {
    const db = {
      tenantProduto: { findUnique: vi.fn().mockResolvedValue({ assinanteId: "a1" }) },
      fatura: { findMany: vi.fn().mockResolvedValue([{ id: "f1", competencia: "2026-09", vencimentoEm: new Date(), status: "PAGA", totalCentavos: 1000, pagaEm: new Date(), itens: [{ tenantUnidadeId: "1", nomeUnidade: "Centro", alunosAtivos: 8, alunosPorBloco: 10, blocosCobrados: 1, precoPorBlocoCentavos: 1000, valorCentavos: 1000 }] }]) },
    };
    const resultado = await new ListarFaturasTenantService(db as never).execute("sysbelt", "academia-centro");
    expect(db.fatura.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assinanteId: "a1" }, take: 12 }));
    expect(resultado[0]).toMatchObject({ id: "f1", alunosContados: 8, blocos: 1, valorCentavos: 1000 });
    expect(resultado[0]).not.toHaveProperty("assinanteId");
  });
});
