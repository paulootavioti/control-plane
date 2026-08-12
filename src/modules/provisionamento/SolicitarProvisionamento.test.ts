import { describe, expect, it, vi } from "vitest";

import { SolicitarProvisionamento } from "./SolicitarProvisionamento";

describe("solicitação de provisionamento", () => {
  it("devolve o mesmo ambiente em uma repetição", async () => {
    const db = {
      ambienteTenant: { findUnique: vi.fn().mockResolvedValue({
        id: "ambiente-1", tenantKey: "tenant-1", eventos: [{ id: "evento-1" }],
      }) },
    };
    const resultado = await new SolicitarProvisionamento(db as never).execute({
      assinanteId: "assinante-1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "v1",
    });
    expect(resultado).toEqual({
      ambienteId: "ambiente-1", tenantKey: "tenant-1", eventoId: "evento-1", duplicado: true,
    });
  });

  it("cria ambiente, evento e muda o assinante na mesma transação", async () => {
    const tx = {
      assinante: {
        findUnique: vi.fn().mockResolvedValue({ id: "assinante-1", status: "PROSPECT" }),
        update: vi.fn(),
      },
      ambienteTenant: { create: vi.fn().mockResolvedValue({
        id: "ambiente-1", tenantKey: "tenant-1", eventos: [{ id: "evento-1" }],
      }) },
    };
    const db = {
      ambienteTenant: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (operacao) => operacao(tx)),
    };
    const resultado = await new SolicitarProvisionamento(db as never).execute({
      assinanteId: "assinante-1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "v1",
    });
    expect(resultado.duplicado).toBe(false);
    expect(tx.ambienteTenant.create).toHaveBeenCalledOnce();
    expect(tx.assinante.update).toHaveBeenCalledWith({
      where: { id: "assinante-1" }, data: { status: "EM_PROVISIONAMENTO" },
    });
  });

  it("recusa assinante suspenso antes de criar recursos", async () => {
    const tx = {
      assinante: { findUnique: vi.fn().mockResolvedValue({ id: "a1", status: "SUSPENSO" }) },
      ambienteTenant: { create: vi.fn() },
    };
    const db = {
      ambienteTenant: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (operacao) => operacao(tx)),
    };
    await expect(new SolicitarProvisionamento(db as never).execute({
      assinanteId: "a1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "v1",
    })).rejects.toThrow("ASSINANTE_NAO_ELEGIVEL");
    expect(tx.ambienteTenant.create).not.toHaveBeenCalled();
  });
});
