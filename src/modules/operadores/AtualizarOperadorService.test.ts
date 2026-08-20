import { describe, expect, it, vi } from "vitest";
import { AtualizarOperadorService } from "./AtualizarOperadorService";

const auditoria = { operadorId: "admin1", origem: "OPERADOR" as const, ip: null, userAgent: null };
function banco(atual: Record<string, unknown>, total = 2) {
  const count = vi.fn().mockResolvedValue(total);
  const update = vi.fn().mockResolvedValue({ ...atual, nome: "Nome novo", email: "novo@test.com", perfil: "SUPORTE" });
  const auditCreate = vi.fn();
  const tx = { operadorPlataforma: { findUnique: vi.fn().mockResolvedValue(atual), count, update }, auditLogPlataforma: { create: auditCreate } };
  const transaction = vi.fn(async (fn) => fn(tx));
  return { count, update, auditCreate, transaction, db: { $transaction: transaction } };
}

describe("atualização de operador da plataforma", () => {
  it("invalida sessões, não expõe credenciais e audita somente valores de/para", async () => {
    const { update, auditCreate, transaction, db } = banco({ id: "op2", nome: "Antigo", email: "antigo@test.com", perfil: "OPERADOR", ativo: true });
    const resultado = await new AtualizarOperadorService(db as never).execute("op2", { nome: "Nome novo", email: "novo@test.com", perfil: "SUPORTE" }, auditoria);
    expect(resultado.alterado).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { nome: "Nome novo", email: "novo@test.com", perfil: "SUPORTE", versaoToken: { increment: 1 } },
      select: expect.not.objectContaining({ senhaHash: true, versaoToken: true }),
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "OPERADOR_ATUALIZADO", mudancas: {
      nome: { de: "Antigo", para: "Nome novo" }, email: { de: "antigo@test.com", para: "novo@test.com" }, perfil: { de: "OPERADOR", para: "SUPORTE" },
    } }) });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain("senha");
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("permite editar nome e email próprios sem rebaixamento", async () => {
    const { count, db } = banco({ id: "admin1", nome: "Admin", email: "admin@test.com", perfil: "ADMIN_PLATAFORMA", ativo: true });
    await expect(new AtualizarOperadorService(db as never).execute("admin1", { nome: "Nome novo", email: "novo@test.com", perfil: "ADMIN_PLATAFORMA" }, auditoria)).resolves.toMatchObject({ alterado: true });
    expect(count).not.toHaveBeenCalled();
  });

  it("recusa autorrebaixamento", async () => {
    const { update, db } = banco({ id: "admin1", nome: "Admin", email: "admin@test.com", perfil: "ADMIN_PLATAFORMA", ativo: true });
    await expect(new AtualizarOperadorService(db as never).execute("admin1", { nome: "Admin", email: "admin@test.com", perfil: "OPERADOR" }, auditoria)).rejects.toThrow("AUTORREBAIXAMENTO_NAO_PERMITIDO");
    expect(update).not.toHaveBeenCalled();
  });

  it("preserva o último administrador ativo", async () => {
    const { update, db } = banco({ id: "admin2", nome: "Admin", email: "admin2@test.com", perfil: "ADMIN_PLATAFORMA", ativo: true }, 1);
    await expect(new AtualizarOperadorService(db as never).execute("admin2", { nome: "Admin", email: "admin2@test.com", perfil: "SUPORTE" }, auditoria)).rejects.toThrow("ULTIMO_ADMIN_ATIVO");
    expect(update).not.toHaveBeenCalled();
  });
});
