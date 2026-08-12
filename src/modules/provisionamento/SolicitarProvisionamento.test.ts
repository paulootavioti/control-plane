import { describe, expect, it, vi } from "vitest";

import { SolicitarProvisionamento } from "./SolicitarProvisionamento";

const auditoria = {
  operadorId: "operador-1",
  origem: "OPERADOR" as const,
  ip: "127.0.0.1",
  userAgent: "vitest",
};

describe("solicitação de provisionamento", () => {
  it("devolve o mesmo ambiente em uma repetição", async () => {
    const db = {
      ambienteTenant: { findUnique: vi.fn().mockResolvedValue({
        id: "ambiente-1", tenantKey: "tenant-1", eventos: [{ id: "evento-1" }],
      }) },
    };
    const resultado = await new SolicitarProvisionamento(db as never).execute({
      assinanteId: "assinante-1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "v1",
    }, auditoria);
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
      assinatura: { findFirst: vi.fn().mockResolvedValue({ id: "assinatura-1" }) },
      ambienteTenant: { create: vi.fn().mockResolvedValue({
        id: "ambiente-1", tenantKey: "tenant-1", eventos: [{ id: "evento-1" }],
      }) },
      auditLogPlataforma: { create: vi.fn() },
    };
    const db = {
      ambienteTenant: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (operacao) => operacao(tx)),
    };
    const resultado = await new SolicitarProvisionamento(db as never).execute({
      assinanteId: "assinante-1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "v1",
    }, auditoria);
    expect(resultado.duplicado).toBe(false);
    expect(tx.ambienteTenant.create).toHaveBeenCalledOnce();
    expect(tx.assinante.update).toHaveBeenCalledWith({
      where: { id: "assinante-1" }, data: { status: "EM_PROVISIONAMENTO" },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      operadorId: "operador-1",
      assinanteId: "assinante-1",
      acao: "PROVISIONAMENTO_SOLICITADO",
      alvoTipo: "AMBIENTE_TENANT",
      alvoId: "ambiente-1",
    }) });
  });

  it("recusa assinante sem assinatura corrente elegível", async () => {
    const tx = {
      assinante: { findUnique: vi.fn().mockResolvedValue({ id: "a1", status: "PROSPECT" }) },
      assinatura: { findFirst: vi.fn().mockResolvedValue(null) },
      ambienteTenant: { create: vi.fn() },
    };
    const db = {
      ambienteTenant: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (operacao) => operacao(tx)),
    };
    await expect(new SolicitarProvisionamento(db as never).execute({
      assinanteId: "a1", regiao: "aws-sa-east-1", schemaVersaoDesejada: "v1",
    }, auditoria)).rejects.toThrow("ASSINATURA_NAO_ELEGIVEL");
    expect(tx.ambienteTenant.create).not.toHaveBeenCalled();
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
    }, auditoria)).rejects.toThrow("ASSINANTE_NAO_ELEGIVEL");
    expect(tx.ambienteTenant.create).not.toHaveBeenCalled();
  });
});
