import { describe, expect, it, vi } from "vitest";

import { AlterarStatusOperadorService } from "./AlterarStatusOperadorService";

const auditoria = {
  operadorId: "admin1", origem: "OPERADOR" as const, ip: null, userAgent: null,
};

function banco(atual: Record<string, unknown>, administradoresAtivos = 2) {
  const findUnique = vi.fn().mockResolvedValue(atual);
  const count = vi.fn().mockResolvedValue(administradoresAtivos);
  const update = vi.fn().mockResolvedValue({ ...atual, ativo: false, atualizadoEm: new Date() });
  const auditCreate = vi.fn();
  const tx = {
    operadorPlataforma: { findUnique, count, update },
    auditLogPlataforma: { create: auditCreate },
  };
  return { update, auditCreate, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("alteração do estado do operador", () => {
  it("desativa, invalida sessões e audita somente a mudança de estado", async () => {
    const { update, auditCreate, db } = banco({
      id: "op2", nome: "Suporte", email: "suporte@test", perfil: "SUPORTE", ativo: true,
    });

    const resultado = await new AlterarStatusOperadorService(db as never).execute("op2", false, auditoria);

    expect(resultado.alterado).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { ativo: false, versaoToken: { increment: 1 } },
      select: expect.not.objectContaining({ senhaHash: true, versaoToken: true }),
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "OPERADOR_DESATIVADO",
      alvoId: "op2",
      mudancas: { ativo: { de: true, para: false } },
    }) });
  });

  it("recusa autodesativação antes de consultar o banco", async () => {
    const db = { $transaction: vi.fn() };
    await expect(new AlterarStatusOperadorService(db as never).execute("admin1", false, auditoria))
      .rejects.toThrow("AUTODESATIVACAO_NAO_PERMITIDA");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("preserva o último administrador ativo", async () => {
    const { update, db } = banco({
      id: "admin2", nome: "Admin", email: "admin@test", perfil: "ADMIN_PLATAFORMA", ativo: true,
    }, 1);
    await expect(new AlterarStatusOperadorService(db as never).execute("admin2", false, auditoria))
      .rejects.toThrow("ULTIMO_ADMIN_ATIVO");
    expect(update).not.toHaveBeenCalled();
  });
});
