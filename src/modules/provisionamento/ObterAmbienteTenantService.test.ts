import { describe, expect, it, vi } from "vitest";

import { ObterAmbienteTenantService } from "./ObterAmbienteTenantService";

describe("detalhe do ambiente tenant", () => {
  it("seleciona somente dados operacionais seguros e limita os eventos", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "amb1", status: "FALHOU", provider: "NEON", regiao: "sa-east-1",
      schemaVersaoAtual: "1", schemaVersaoDesejada: "2",
      assinante: { id: "ass1", nomeFantasia: "Academia", slug: "academia", status: "ATIVO" },
      eventos: [{
        id: "ev1", tipo: "APLICAR_MIGRATIONS", status: "FALHOU",
        etapaAtual: "migrations", tentativas: 5, erroSanitizado: "falha temporária",
      }],
    });
    const resultado = await new ObterAmbienteTenantService({ ambienteTenant: { findUnique } } as never)
      .execute("amb1");

    expect(resultado).toMatchObject({
      schemaDesatualizado: true,
      necessitaAtencao: true,
      eventos: [{ retomadaManualDisponivel: true }],
    });
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.select.eventos).toMatchObject({ take: 20 });
    expect(consulta.select).not.toHaveProperty("providerProjectId");
    expect(consulta.select).not.toHaveProperty("providerBranchId");
    expect(consulta.select).not.toHaveProperty("providerEndpointId");
    expect(consulta.select).not.toHaveProperty("databaseName");
    expect(consulta.select).not.toHaveProperty("roleName");
    expect(consulta.select).not.toHaveProperty("secretRef");
    expect(consulta.select).not.toHaveProperty("chavePublicaIntegracao");
    expect(consulta.select.eventos.select).not.toHaveProperty("payload");
    expect(consulta.select.eventos.select).not.toHaveProperty("chaveIdempotencia");
  });

  it("marca retomada indisponível antes de cinco tentativas", async () => {
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({
      id: "amb1", status: "ATIVO", schemaVersaoAtual: "2", schemaVersaoDesejada: "2",
      assinante: { id: "ass1" }, eventos: [{ status: "FALHOU", tentativas: 4 }],
    }) } };
    const resultado = await new ObterAmbienteTenantService(db as never).execute("amb1");
    expect(resultado).toMatchObject({ schemaDesatualizado: false, necessitaAtencao: false });
    expect(resultado.eventos[0].retomadaManualDisponivel).toBe(false);
  });

  it("retorna erro quando o ambiente não existe", async () => {
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterAmbienteTenantService(db as never).execute("amb1"))
      .rejects.toThrow("AMBIENTE_NAO_ENCONTRADO");
  });
});
