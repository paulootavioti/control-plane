import { describe, expect, it } from "vitest";
import { ProvedorPagamentoFake } from "./ProvedorPagamentoFake";

describe("ProvedorPagamentoFake", () => {
  it("torna criação idempotente", async () => {
    const provedor = new ProvedorPagamentoFake();
    const dados = { referenciaExterna: "assinante-1", nome: "Cliente", email: "c@example.com" };
    expect(await provedor.criarCliente(dados, "op-1"))
      .toEqual(await provedor.criarCliente(dados, "op-1"));
    expect(provedor.clientes).toHaveLength(1);
  });
});
