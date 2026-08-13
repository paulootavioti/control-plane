import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AtualizarAssinanteService } from "./AtualizarAssinanteService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const atual = {
  id: "a1", nomeFantasia: "Academia Centro", razaoSocial: "Centro Ltda",
  documento: "12345678000199", emailCobranca: "antigo@teste.com", telefone: "11999990000",
  slug: "academia-centro", status: "ATIVO", criadoEm: new Date(), atualizadoEm: new Date(),
};

function banco(registro: typeof atual | null = atual) {
  const update = vi.fn().mockImplementation(({ data }) => ({ ...atual, ...data }));
  const auditCreate = vi.fn();
  const tx = { assinante: { findUnique: vi.fn().mockResolvedValue(registro), update }, auditLogPlataforma: { create: auditCreate } };
  const transaction = vi.fn(async (operacao) => operacao(tx));
  return { db: { $transaction: transaction }, update, auditCreate, transaction };
}

describe("atualização comercial de assinante", () => {
  it("atualiza apenas os campos recebidos e mascara dados sensíveis na auditoria", async () => {
    const { db, update, auditCreate, transaction } = banco();
    const resultado = await new AtualizarAssinanteService(db as never).execute("a1", {
      nomeFantasia: "Academia Norte", documento: "98765432000188",
      emailCobranca: "novo@teste.com", telefone: null,
    }, auditoria);

    expect(resultado).toMatchObject({ alterado: true, assinante: { nomeFantasia: "Academia Norte" } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "a1" },
      data: { nomeFantasia: "Academia Norte", documento: "98765432000188", emailCobranca: "novo@teste.com", telefone: null },
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "ASSINANTE_ATUALIZADO", assinanteId: "a1", alvoTipo: "ASSINANTE", alvoId: "a1",
      mudancas: {
        nomeFantasia: { de: "Academia Centro", para: "Academia Norte" },
        documento: { alterado: true }, emailCobranca: { alterado: true }, telefone: { alterado: true },
      },
    }) });
    const log = JSON.stringify(auditCreate.mock.calls);
    expect(log).not.toContain("98765432000188");
    expect(log).not.toContain("novo@teste.com");
    expect(log).not.toContain("11999990000");
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("é idempotente e não grava atualização nem auditoria sem mudança real", async () => {
    const { db, update, auditCreate } = banco();
    const resultado = await new AtualizarAssinanteService(db as never).execute("a1", {
      nomeFantasia: atual.nomeFantasia, slug: atual.slug,
    }, auditoria);
    expect(resultado.alterado).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("retorna erro para assinante inexistente", async () => {
    const { db, update } = banco(null);
    await expect(new AtualizarAssinanteService(db as never).execute("a1", { nomeFantasia: "Outro" }, auditoria))
      .rejects.toThrow("ASSINANTE_NAO_ENCONTRADO");
    expect(update).not.toHaveBeenCalled();
  });

  it("traduz conflito de unicidade de documento ou slug", async () => {
    const { db, update } = banco();
    update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "6" }));
    await expect(new AtualizarAssinanteService(db as never).execute("a1", { slug: "slug-duplicado" }, auditoria))
      .rejects.toThrow("ASSINANTE_DUPLICADO");
  });
});
