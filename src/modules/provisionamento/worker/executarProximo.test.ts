import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/prisma", () => ({ prisma: {} }));

import { executarProximo } from "./executarProximo";
import { RepositorioProvisionamentoPrisma } from "./RepositorioProvisionamentoPrisma";

describe("runner da fila", () => {
  it("encerra sem chamar infraestrutura quando não há evento", async () => {
    vi.spyOn(RepositorioProvisionamentoPrisma.prototype, "obterProximoElegivel").mockResolvedValue(null);
    const infraestrutura = {
      criarOuReconciliarProjeto: vi.fn(), gravarOuValidarSegredo: vi.fn(),
      aplicarMigrations: vi.fn(), executarBootstrap: vi.fn(), validarSaude: vi.fn(),
    };

    await expect(executarProximo(infraestrutura)).resolves.toBe("VAZIO");
    expect(infraestrutura.criarOuReconciliarProjeto).not.toHaveBeenCalled();
  });
});
