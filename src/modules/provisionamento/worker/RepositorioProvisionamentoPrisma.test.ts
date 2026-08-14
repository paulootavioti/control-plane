import { describe, expect, it, vi } from "vitest";

import { RepositorioProvisionamentoPrisma } from "./RepositorioProvisionamentoPrisma";

function criarDb(tentativas = 1) {
  return {
    ambienteTenant: { update: vi.fn().mockReturnValue({ tipo: "ambiente" }) },
    eventoProvisionamento: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ tentativas }),
      update: vi.fn().mockReturnValue({ tipo: "evento" }),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
}

describe("resultado persistido do provisionamento", () => {
  it("registra a nova versão da credencial sem armazenar segredo", async () => {
    const db = criarDb();
    await new RepositorioProvisionamentoPrisma(db as never).registrarRotacao("ambiente-1");
    expect(db.ambienteTenant.update).toHaveBeenCalledWith({
      where: { id: "ambiente-1" },
      data: { credentialVersion: { increment: 1 }, ultimaRotacaoEm: expect.any(Date) },
    });
  });
  it("ativa ambiente e assinante na mesma transação ao concluir", async () => {
    const db = criarDb();

    await new RepositorioProvisionamentoPrisma(db as never).concluir("evento-1", "ambiente-1");

    expect(db.ambienteTenant.update).toHaveBeenCalledWith({
      where: { id: "ambiente-1" },
      data: { status: "ATIVO", assinante: { update: { status: "ATIVO" } } },
    });
    expect(db.$transaction).toHaveBeenCalledOnce();
  });

  it("mantém o assinante em provisionamento enquanto ainda haverá nova tentativa", async () => {
    const db = criarDb(2);

    await new RepositorioProvisionamentoPrisma(db as never).falhar("evento-1", "ambiente-1", "erro seguro");

    expect(db.ambienteTenant.update).toHaveBeenCalledWith({
      where: { id: "ambiente-1" },
      data: { status: "FALHOU" },
    });
    expect(db.eventoProvisionamento.update).toHaveBeenCalledWith({
      where: { id: "evento-1" },
      data: expect.objectContaining({ status: "FALHOU", erroSanitizado: "erro seguro" }),
    });
  });

  it("marca erro comercial quando as tentativas se esgotam", async () => {
    const db = criarDb(5);

    await new RepositorioProvisionamentoPrisma(db as never).falhar("evento-1", "ambiente-1", "erro seguro");

    expect(db.ambienteTenant.update).toHaveBeenCalledWith({
      where: { id: "ambiente-1" },
      data: {
        status: "FALHOU",
        assinante: { update: { status: "ERRO_PROVISIONAMENTO" } },
      },
    });
    expect(db.eventoProvisionamento.update).toHaveBeenCalledWith({
      where: { id: "evento-1" },
      data: expect.objectContaining({ proximaTentativaEm: null }),
    });
  });
});
