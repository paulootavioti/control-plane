import { describe, expect, it, vi } from "vitest";
import { ObterSnapshotContagemService } from "./ObterSnapshotContagemService";

describe("detalhe do snapshot agregado", () => {
  it("retorna unidades e totais sem dados individuais ou credenciais", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "s1", eventoExternoId: "evento-1",
      assinante: { id: "a1", nomeFantasia: "Academia" },
      itens: [
        { alunosAtivos: 12, licenca: { id: "l1", tenantUnidadeId: "u1", nomeExibicao: "Centro", status: "ATIVA" } },
        { alunosAtivos: 8, licenca: { id: "l2", tenantUnidadeId: "u2", nomeExibicao: "Norte", status: "ATIVA" } },
      ],
    });
    const resultado = await new ObterSnapshotContagemService({ snapshotContagem: { findUnique } } as never).execute("s1");
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "s1" });
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(consulta.select.itens.select).not.toHaveProperty("id");
    expect(consulta.select.itens.select.licenca.select).not.toHaveProperty("assinante");
    expect(resultado.totalUnidades).toBe(2);
    expect(resultado.totalAlunosAtivos).toBe(20);
    expect(resultado.itens[0]).toMatchObject({
      licencaId: "l1", unidadeId: "u1", unidadeNome: "Centro", alunosAtivos: 12,
    });
  });

  it("retorna erro uniforme para snapshot ausente", async () => {
    const db = { snapshotContagem: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterSnapshotContagemService(db as never).execute("s1"))
      .rejects.toThrow("SNAPSHOT_NAO_ENCONTRADO");
  });
});
