import { describe, expect, it, vi } from "vitest";
import { ListarExecucoesWorkerBillingService } from "./ListarExecucoesWorkerBillingService";

describe("consulta do histórico do worker", () => {
  it("limita, ordena e não seleciona dados de filas", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await expect(new ListarExecucoesWorkerBillingService({ execucaoWorkerBilling: { findMany } } as never).execute(10))
      .resolves.toEqual([]);
    const consulta = findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({ orderBy: { iniciadoEm: "desc" }, take: 10 });
    expect(consulta.select).not.toHaveProperty("payload");
    expect(consulta.select).not.toHaveProperty("destinatario");
  });
});
