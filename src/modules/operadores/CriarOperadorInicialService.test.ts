import { PerfilOperador } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CriarOperadorInicialService } from "./CriarOperadorInicialService";

const dados = { nome: "Admin", email: "admin@example.com", senhaHash: "hash-seguro" };

function banco(tx: object) {
  return { $transaction: vi.fn(async (executar) => executar(tx)) };
}

describe("bootstrap do operador inicial", () => {
  it("cria somente o primeiro administrador", async () => {
    const create = vi.fn().mockResolvedValue({ id: "admin-1" });
    const tx = { operadorPlataforma: {
      findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create,
    } };
    await expect(new CriarOperadorInicialService(banco(tx) as never).execute(dados))
      .resolves.toEqual({ criado: true, operadorId: "admin-1" });
    expect(create).toHaveBeenCalledWith({
      data: { ...dados, perfil: PerfilOperador.ADMIN_PLATAFORMA }, select: { id: true },
    });
  });

  it("é idempotente para o mesmo administrador ativo", async () => {
    const tx = { operadorPlataforma: {
      findUnique: vi.fn().mockResolvedValue({ id: "admin-1", ativo: true, perfil: PerfilOperador.ADMIN_PLATAFORMA }),
      count: vi.fn(), create: vi.fn(),
    } };
    await expect(new CriarOperadorInicialService(banco(tx) as never).execute(dados))
      .resolves.toEqual({ criado: false, operadorId: "admin-1" });
    expect(tx.operadorPlataforma.create).not.toHaveBeenCalled();
  });

  it("não promove e-mail conflitante nem cria um segundo administrador", async () => {
    const conflitante = { operadorPlataforma: {
      findUnique: vi.fn().mockResolvedValue({ id: "op-1", ativo: true, perfil: PerfilOperador.OPERADOR }),
      count: vi.fn(), create: vi.fn(),
    } };
    await expect(new CriarOperadorInicialService(banco(conflitante) as never).execute(dados))
      .rejects.toThrow("OPERADOR_INICIAL_EMAIL_CONFLITANTE");

    const existente = { operadorPlataforma: {
      findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(1), create: vi.fn(),
    } };
    await expect(new CriarOperadorInicialService(banco(existente) as never).execute(dados))
      .rejects.toThrow("OPERADOR_INICIAL_JA_CONFIGURADO");
    expect(existente.operadorPlataforma.create).not.toHaveBeenCalled();
  });
});
