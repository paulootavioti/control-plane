import { describe, expect, it, vi } from "vitest";

import { AlterarStatusPlanoService } from "./AlterarStatusPlanoService";

const auditoria = {
  operadorId: "admin1", origem: "OPERADOR" as const, ip: "127.0.0.1", userAgent: "teste",
};

function banco(ativoAtual: boolean | null) {
  const findUnique = vi.fn().mockResolvedValue(ativoAtual === null ? null : {
    id: "plano1", nome: "Essencial", ativo: ativoAtual, atualizadoEm: new Date("2026-08-13T00:00:00Z"),
  });
  const update = vi.fn().mockImplementation(({ data }) => ({
    id: "plano1", nome: "Essencial", ativo: data.ativo, atualizadoEm: new Date("2026-08-13T01:00:00Z"),
  }));
  const auditCreate = vi.fn();
  const tx = {
    plano: { findUnique, update },
    auditLogPlataforma: { create: auditCreate },
  };
  return { db: { $transaction: vi.fn(async (operacao) => operacao(tx)) }, findUnique, update, auditCreate };
}

describe("estado do plano", () => {
  it("desativa somente o plano e registra uma auditoria sanitizada", async () => {
    const { db, update, auditCreate } = banco(true);
    const resultado = await new AlterarStatusPlanoService(db as never).execute("plano1", false, auditoria);

    expect(resultado).toMatchObject({ alterado: true, plano: { ativo: false } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "plano1" }, data: { ativo: false },
      select: { id: true, nome: true, ativo: true, atualizadoEm: true },
    });
    expect(auditCreate).toHaveBeenCalledWith({ data: {
      ...auditoria, acao: "PLANO_DESATIVADO", alvoTipo: "PLANO", alvoId: "plano1",
      mudancas: { ativoAnterior: true, ativo: false },
    } });
    expect(JSON.stringify(auditCreate.mock.calls[0][0])).not.toContain("descricao");
  });

  it("é idempotente quando o plano já está no estado solicitado", async () => {
    const { db, update, auditCreate } = banco(false);
    const resultado = await new AlterarStatusPlanoService(db as never).execute("plano1", false, auditoria);

    expect(resultado).toMatchObject({ alterado: false, plano: { ativo: false } });
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("ativa o plano e usa a ação correspondente", async () => {
    const { db, auditCreate } = banco(false);
    await new AlterarStatusPlanoService(db as never).execute("plano1", true, auditoria);
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "PLANO_ATIVADO" }) });
  });

  it("retorna erro quando o plano não existe", async () => {
    const { db, update, auditCreate } = banco(null);
    await expect(new AlterarStatusPlanoService(db as never).execute("plano1", false, auditoria))
      .rejects.toThrow("PLANO_NAO_ENCONTRADO");
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
