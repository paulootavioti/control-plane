import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/regrasAuth", () => ({ criarSenhaHash: vi.fn().mockResolvedValue("novo-hash") }));

import { RedefinirSenhaOperadorService } from "./RedefinirSenhaOperadorService";

const auditoria = {
  operadorId: "admin1", origem: "OPERADOR" as const, ip: "127.0.0.1", userAgent: "teste",
};

describe("redefinição de senha do operador", () => {
  it("substitui o hash, invalida sessões e audita sem credenciais", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "op2" });
    const update = vi.fn().mockResolvedValue({
      id: "op2", nome: "Suporte", email: "suporte@test", perfil: "SUPORTE", ativo: true,
    });
    const auditCreate = vi.fn();
    const tx = {
      operadorPlataforma: { findUnique, update },
      auditLogPlataforma: { create: auditCreate },
    };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };

    const resultado = await new RedefinirSenhaOperadorService(db as never)
      .execute("op2", "nova-senha-segura", auditoria);

    expect(resultado).not.toHaveProperty("senhaHash");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { senhaHash: "novo-hash", versaoToken: { increment: 1 } },
      select: expect.not.objectContaining({ senhaHash: true, versaoToken: true }),
    }));
    const log = auditCreate.mock.calls[0][0].data;
    expect(log).toEqual(expect.objectContaining({
      acao: "SENHA_OPERADOR_REDEFINIDA",
      alvoId: "op2",
      mudancas: { sessoesAnterioresInvalidadas: true },
    }));
    expect(JSON.stringify(log)).not.toContain("nova-senha-segura");
    expect(JSON.stringify(log)).not.toContain("novo-hash");
  });

  it("distingue operador inexistente", async () => {
    const tx = { operadorPlataforma: { findUnique: vi.fn().mockResolvedValue(null) } };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };
    await expect(new RedefinirSenhaOperadorService(db as never)
      .execute("ausente", "nova-senha-segura", auditoria)).rejects.toThrow("OPERADOR_NAO_ENCONTRADO");
  });
});
