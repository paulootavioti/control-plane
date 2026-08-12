import { describe, expect, it, vi } from "vitest";

import { CriarAssinanteService } from "./CriarAssinanteService";
const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: "127.0.0.1", userAgent: "teste" };

function banco(resultado: Record<string, unknown>) {
  const create = vi.fn().mockResolvedValue(resultado);
  const auditCreate = vi.fn();
  const tx = { assinante: { create }, auditLogPlataforma: { create: auditCreate } };
  return { create, auditCreate, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("cadastro de assinante", () => {
  it("cria prospect com contatos na mesma operação", async () => {
    const { create, auditCreate, db } = banco({ id: "a1", status: "PROSPECT", slug: "academia-centro" });
    const resultado = await new CriarAssinanteService(db as never).execute({
      nomeFantasia: "Academia Centro",
      documento: "12345678000199",
      emailCobranca: "financeiro@centro.test",
      slug: "academia-centro",
      contatos: [{ nome: "Maria", tipo: "PROPRIETARIO", principal: true }],
    }, auditoria);

    expect(resultado).toEqual(expect.objectContaining({ id: "a1", status: "PROSPECT" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PROSPECT",
        contatos: { create: [{ nome: "Maria", tipo: "PROPRIETARIO", principal: true }] },
      }),
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "ASSINANTE_CRIADO", alvoId: "a1" }) });
  });

  it("não inicia assinatura ou provisionamento implicitamente", async () => {
    const { create, db } = banco({ id: "a1", slug: "academia-centro" });
    await new CriarAssinanteService(db as never).execute({
      nomeFantasia: "Academia Centro",
      documento: "12345678000199",
      emailCobranca: "financeiro@centro.test",
      slug: "academia-centro",
      contatos: [],
    }, auditoria);
    const data = create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("assinaturas");
    expect(data).not.toHaveProperty("ambiente");
  });
});
