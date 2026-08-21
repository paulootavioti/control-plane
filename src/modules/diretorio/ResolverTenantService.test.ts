import { describe, expect, it, vi } from "vitest";
import { ResolverTenantService } from "./ResolverTenantService";

describe("ResolverTenantService", () => {
  it("devolve somente o material mínimo de roteamento", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d", status: "ATIVO",
      secretRef: "arn:aws:secretsmanager:tenant", schemaVersaoAtual: "2026.08.1",
      credentialVersion: 3,
      produto: { codigo: "psyche", politicaAcessoInadimplencia: "SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO" },
    });
    const resultado = await new ResolverTenantService({ tenantProduto: { findFirst } } as never)
      .execute("psyche", "clinica-centro");
    expect(resultado).toMatchObject({
      tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d", produto: "psyche", slug: "clinica-centro",
      status: "ATIVO", secretRef: "arn:aws:secretsmanager:tenant",
      tenantSchemaVersion: "2026.08.1", credentialVersion: 3,
      acesso: { administrativo: "LIBERADO", clinico: "LIBERADO" },
    });
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ produtoCodigo: "psyche", slug: "clinica-centro" });
    expect(findFirst.mock.calls[0][0].select).not.toHaveProperty("providerProjectId");
    expect(findFirst.mock.calls[0][0].select).not.toHaveProperty("databaseName");
  });

  it("não roteia ambiente incompleto ou fora dos estados permitidos", async () => {
    const db = { tenantProduto: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(new ResolverTenantService(db as never).execute("sysbelt", "desconhecido")).rejects.toThrow("TENANT_NAO_ENCONTRADO");
    expect(db.tenantProduto.findFirst.mock.calls[0][0].where.status)
      .toEqual({ in: ["ATIVO", "SUSPENSO_FINANCEIRO", "SUSPENSO_OPERACIONAL"] });
  });
});
