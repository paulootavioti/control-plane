import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/regrasAuth", () => ({ criarSenhaHash: vi.fn().mockResolvedValue("hash-seguro") }));

import { CriarOperadorService } from "./CriarOperadorService";

const auditoria = {
  operadorId: "admin1",
  origem: "OPERADOR" as const,
  ip: "127.0.0.1",
  userAgent: "teste",
};

describe("cadastro de operador da plataforma", () => {
  it("cria operador ativo e audita sem registrar senha ou e-mail", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "op2", nome: "Financeiro", email: "financeiro@sysbelt.test",
      perfil: "FINANCEIRO", ativo: true,
    });
    const auditCreate = vi.fn();
    const tx = { operadorPlataforma: { create }, auditLogPlataforma: { create: auditCreate } };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };

    const resultado = await new CriarOperadorService(db as never).execute({
      nome: "Financeiro",
      email: "financeiro@sysbelt.test",
      senha: "senha-segura",
      perfil: "FINANCEIRO",
    }, auditoria);

    expect(resultado).not.toHaveProperty("senhaHash");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senhaHash: "hash-seguro", perfil: "FINANCEIRO", ativo: true }),
      select: expect.not.objectContaining({ senhaHash: true }),
    }));
    const log = auditCreate.mock.calls[0][0].data;
    expect(log).toEqual(expect.objectContaining({
      operadorId: "admin1", acao: "OPERADOR_CRIADO", alvoId: "op2",
      mudancas: { perfil: "FINANCEIRO", ativo: true },
    }));
    expect(JSON.stringify(log)).not.toContain("senha");
    expect(JSON.stringify(log)).not.toContain("financeiro@sysbelt.test");
  });
});
