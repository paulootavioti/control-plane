import { describe, expect, it, vi } from "vitest";

import { CriarAssinanteService } from "./CriarAssinanteService";

describe("cadastro de assinante", () => {
  it("cria prospect com contatos na mesma operação", async () => {
    const create = vi.fn().mockResolvedValue({ id: "a1", status: "PROSPECT" });
    const resultado = await new CriarAssinanteService({ assinante: { create } } as never).execute({
      nomeFantasia: "Academia Centro",
      documento: "12345678000199",
      emailCobranca: "financeiro@centro.test",
      slug: "academia-centro",
      contatos: [{ nome: "Maria", tipo: "PROPRIETARIO", principal: true }],
    });

    expect(resultado).toEqual({ id: "a1", status: "PROSPECT" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PROSPECT",
        contatos: { create: [{ nome: "Maria", tipo: "PROPRIETARIO", principal: true }] },
      }),
    }));
  });

  it("não inicia assinatura ou provisionamento implicitamente", async () => {
    const create = vi.fn().mockResolvedValue({ id: "a1" });
    await new CriarAssinanteService({ assinante: { create } } as never).execute({
      nomeFantasia: "Academia Centro",
      documento: "12345678000199",
      emailCobranca: "financeiro@centro.test",
      slug: "academia-centro",
      contatos: [],
    });
    const data = create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("assinaturas");
    expect(data).not.toHaveProperty("ambiente");
  });
});
