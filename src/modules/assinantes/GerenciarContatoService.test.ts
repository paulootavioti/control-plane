import { describe, expect, it, vi } from "vitest";

import { GerenciarContatoService } from "./GerenciarContatoService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const atual = {
  id: "c1", assinanteId: "a1", nome: "Maria", email: "maria@example.com",
  telefone: "11999999999", tipo: "FINANCEIRO", principal: false,
  criadoEm: new Date(), atualizadoEm: new Date(),
};

function bancoTransacional(tx: object) {
  return { $transaction: vi.fn(async (callback) => callback(tx)) };
}

describe("gestão de contato comercial", () => {
  it("promove o principal atomicamente e audita apenas nomes de campos", async () => {
    const updateMany = vi.fn();
    const update = vi.fn().mockResolvedValue({ ...atual, email: "novo@example.com", principal: true });
    const create = vi.fn();
    const tx = {
      contatoAssinante: { findFirst: vi.fn().mockResolvedValue(atual), updateMany, update },
      auditLogPlataforma: { create },
    };
    const resultado = await new GerenciarContatoService(bancoTransacional(tx) as never)
      .atualizar("a1", "c1", { email: "novo@example.com", principal: true }, auditoria);

    expect(updateMany).toHaveBeenCalledWith({
      where: { assinanteId: "a1", principal: true, id: { not: "c1" } },
      data: { principal: false },
    });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "CONTATO_ATUALIZADO",
      mudancas: { camposAlterados: ["email", "principal"], principalAnterior: false, principal: true },
    }) });
    expect(JSON.stringify(create.mock.calls[0])).not.toContain("novo@example.com");
    expect(resultado.alterado).toBe(true);
  });

  it("não grava nem audita uma atualização idêntica", async () => {
    const update = vi.fn();
    const create = vi.fn();
    const tx = {
      contatoAssinante: { findFirst: vi.fn().mockResolvedValue(atual), updateMany: vi.fn(), update },
      auditLogPlataforma: { create },
    };
    const resultado = await new GerenciarContatoService(bancoTransacional(tx) as never)
      .atualizar("a1", "c1", { nome: "Maria", principal: false }, auditoria);
    expect(resultado).toEqual({ contato: atual, alterado: false });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("remove sem eleger outro principal e preserva somente metadados na auditoria", async () => {
    const remove = vi.fn();
    const create = vi.fn();
    const tx = {
      contatoAssinante: {
        findFirst: vi.fn().mockResolvedValue({ id: "c1", tipo: "FINANCEIRO", principal: true }),
        delete: remove,
      },
      auditLogPlataforma: { create },
    };
    await new GerenciarContatoService(bancoTransacional(tx) as never).remover("a1", "c1", auditoria);
    expect(remove).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "CONTATO_REMOVIDO", mudancas: { tipo: "FINANCEIRO", eraPrincipal: true },
    }) });
    expect(tx.contatoAssinante).not.toHaveProperty("updateMany");
  });

  it("não revela se o contato existe em outro assinante", async () => {
    const tx = { contatoAssinante: { findFirst: vi.fn().mockResolvedValue(null) }, auditLogPlataforma: { create: vi.fn() } };
    await expect(new GerenciarContatoService(bancoTransacional(tx) as never)
      .remover("a1", "c1", auditoria)).rejects.toThrow("CONTATO_NAO_ENCONTRADO");
    expect(tx.contatoAssinante.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", assinanteId: "a1" }, select: { id: true, tipo: true, principal: true },
    });
  });
});
