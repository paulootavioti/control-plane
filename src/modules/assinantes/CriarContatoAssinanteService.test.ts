import { describe, expect, it, vi } from "vitest";

import { CriarContatoAssinanteService } from "./CriarContatoAssinanteService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: "127.0.0.1", userAgent: "teste" };
const dados = {
  nome: "Maria Silva",
  email: "maria@academia.com",
  telefone: "11999999999",
  tipo: "FINANCEIRO" as const,
  principal: true,
};

function banco(assinante: { id: string } | null = { id: "a1" }) {
  const contato = { id: "c1", assinanteId: "a1", ...dados, criadoEm: new Date("2026-08-13") };
  const tx = {
    assinante: { findUnique: vi.fn().mockResolvedValue(assinante) },
    contatoAssinante: {
      updateMany: vi.fn(),
      create: vi.fn().mockResolvedValue(contato),
    },
    auditLogPlataforma: { create: vi.fn() },
  };
  const transaction = vi.fn(async (operacao) => operacao(tx));
  return { db: { $transaction: transaction }, tx, transaction, contato };
}

describe("cadastro de contato do assinante", () => {
  it("remove o principal anterior e cria o novo na mesma transação serializável", async () => {
    const { db, tx, transaction } = banco();
    const contato = await new CriarContatoAssinanteService(db as never).execute("a1", dados, auditoria);

    expect(contato.id).toBe("c1");
    expect(tx.contatoAssinante.updateMany).toHaveBeenCalledWith({
      where: { assinanteId: "a1", principal: true }, data: { principal: false },
    });
    expect(tx.contatoAssinante.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assinanteId: "a1", principal: true }),
    }));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("não altera os principais ao criar contato secundário", async () => {
    const { db, tx } = banco();
    await new CriarContatoAssinanteService(db as never).execute("a1", { ...dados, principal: false }, auditoria);
    expect(tx.contatoAssinante.updateMany).not.toHaveBeenCalled();
  });

  it("retorna erro quando o assinante não existe", async () => {
    const { db, tx } = banco(null);
    await expect(new CriarContatoAssinanteService(db as never).execute("a1", dados, auditoria))
      .rejects.toThrow("ASSINANTE_NAO_ENCONTRADO");
    expect(tx.contatoAssinante.create).not.toHaveBeenCalled();
  });

  it("audita sem expor e-mail ou telefone", async () => {
    const { db, tx } = banco();
    await new CriarContatoAssinanteService(db as never).execute("a1", dados, auditoria);
    const registro = tx.auditLogPlataforma.create.mock.calls[0][0];
    expect(registro).toEqual({ data: expect.objectContaining({
      acao: "ASSINANTE_CONTATO_CRIADO", alvoTipo: "CONTATO_ASSINANTE", alvoId: "c1",
      mudancas: { tipo: "FINANCEIRO", principal: true },
    }) });
    expect(JSON.stringify(registro)).not.toContain("maria@academia.com");
    expect(JSON.stringify(registro)).not.toContain("11999999999");
  });
});
