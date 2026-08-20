import { describe, expect, it, vi } from "vitest";
import { ObterContatoService } from "./ObterContatoService";

describe("detalhe do contato comercial", () => {
  it("retorna assinante e assinatura corrente com seleção sanitizada", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "c1", nome: "Maria", assinante: {
        id: "a1", nomeFantasia: "Academia", assinaturas: [{ id: "s1", status: "ATIVA" }],
      },
    });
    const resultado = await new ObterContatoService({ contatoAssinante: { findUnique } } as never).execute("c1");
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(consulta.select.assinante.select.assinaturas.where).toEqual({ encerradaEm: null });
    expect(resultado.assinante).toEqual({
      id: "a1", nomeFantasia: "Academia", assinaturaCorrente: { id: "s1", status: "ATIVA" },
    });
  });

  it("retorna erro uniforme para contato ausente", async () => {
    const db = { contatoAssinante: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterContatoService(db as never).execute("c1")).rejects.toThrow("CONTATO_NAO_ENCONTRADO");
  });
});
