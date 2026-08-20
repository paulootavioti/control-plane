import { describe, expect, it, vi } from "vitest";
import { ResolverTenantService } from "./ResolverTenantService";

describe("ResolverTenantService", () => {
  it("devolve somente o material mínimo de roteamento", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d", status: "ATIVO",
      secretRef: "arn:aws:secretsmanager:tenant", schemaVersaoAtual: "2026.08.1",
      credentialVersion: 3, assinante: { slug: "academia-centro" },
    });
    const resultado = await new ResolverTenantService({ ambienteTenant: { findFirst } } as never).execute("academia-centro");
    expect(resultado).toEqual({
      tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d", slug: "academia-centro",
      status: "ATIVO", secretRef: "arn:aws:secretsmanager:tenant",
      schemaVersion: "2026.08.1", credentialVersion: 3,
    });
    expect(findFirst.mock.calls[0][0].select).not.toHaveProperty("providerProjectId");
    expect(findFirst.mock.calls[0][0].select).not.toHaveProperty("databaseName");
  });

  it("não roteia ambiente incompleto ou fora dos estados permitidos", async () => {
    const db = { ambienteTenant: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(new ResolverTenantService(db as never).execute("desconhecido")).rejects.toThrow("TENANT_NAO_ENCONTRADO");
    expect(db.ambienteTenant.findFirst.mock.calls[0][0].where.status).toEqual({ in: ["ATIVO", "SUSPENSO"] });
  });
});
