import { describe, expect, it, vi } from "vitest";

import { VincularTenantCompartilhadoService } from "./VincularTenantCompartilhadoService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };

describe("vínculo de tenant compartilhado", () => {
  it("registra ambiente e diretório como pendentes com a mesma tenant key", async () => {
    const tx = {
      assinante: { findUnique: vi.fn().mockResolvedValue({ id: "a1", slug: "academia-centro", status: "PROSPECT", produtoCodigo: "sysbelt", ambiente: null }) },
      ambienteTenant: { create: vi.fn().mockResolvedValue({ id: "amb1", status: "PENDENTE", provider: "COMPARTILHADO" }) },
      tenantProduto: { create: vi.fn() },
      auditLogPlataforma: { create: vi.fn() },
    };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };
    const tenantKey = "6af23aa7-bd57-4428-aeae-3a237025bb68";
    const resultado = await new VincularTenantCompartilhadoService(db as never).execute("a1", tenantKey, "3.0.2026.09.01", auditoria);
    expect(resultado).toMatchObject({ tenantKey, provider: "COMPARTILHADO", status: "PENDENTE" });
    expect(tx.tenantProduto.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantKey, slug: "academia-centro", status: "PENDENTE" }) });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "TENANT_COMPARTILHADO_VINCULADO" }) });
  });

  it("recusa assinante fora de prospecção", async () => {
    const tx = { assinante: { findUnique: vi.fn().mockResolvedValue({ status: "ATIVO", ambiente: null }) } };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };
    await expect(new VincularTenantCompartilhadoService(db as never).execute("a1", "6af23aa7-bd57-4428-aeae-3a237025bb68", "v1", auditoria))
      .rejects.toThrow("ASSINANTE_NAO_ELEGIVEL");
  });
});
