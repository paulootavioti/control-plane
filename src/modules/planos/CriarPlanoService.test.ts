import { describe, expect, it, vi } from "vitest";

import { CriarPlanoService } from "./CriarPlanoService";

const auditoria = {
  operadorId: "admin1",
  origem: "OPERADOR" as const,
  ip: "127.0.0.1",
  userAgent: "teste",
};

describe("cadastro de plano da plataforma", () => {
  it("cria o plano e a primeira versão imutável na mesma transação", async () => {
    const vigenteDesde = new Date("2026-09-01T00:00:00.000Z");
    const create = vi.fn().mockResolvedValue({
      id: "plano1",
      nome: "Profissional",
      ativo: true,
      versoes: [{
        id: "versao1", versao: 1, vigenteDesde, vigenteAte: null,
        alunosPorBloco: 100, precoPorBlocoCentavos: 19900,
        blocosMinimosPorUnidade: 1, moeda: "BRL",
        recursos: { financeiro: true },
      }],
    });
    const auditCreate = vi.fn();
    const tx = { plano: { create }, auditLogPlataforma: { create: auditCreate } };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };

    const resultado = await new CriarPlanoService(db as never).execute({
      nome: "Profissional",
      descricao: "Plano para academias em expansão",
      vigenteDesde,
      alunosPorBloco: 100,
      precoPorBlocoCentavos: 19900,
      blocosMinimosPorUnidade: 1,
      moeda: "BRL",
      recursos: { financeiro: true },
      metadadosComerciais: { campanhaInterna: "lancamento" },
    }, auditoria);

    expect(resultado.versoes[0].versao).toBe(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ativo: true,
        versoes: { create: expect.objectContaining({ versao: 1, alunosPorBloco: 100 }) },
      }),
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "PLANO_CRIADO",
      alvoTipo: "PLANO",
      alvoId: "plano1",
      mudancas: expect.objectContaining({ versao: 1, precoPorBlocoCentavos: 19900 }),
    }) });
  });

  it("não replica metadados comerciais livres na auditoria", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "plano1",
      versoes: [{
        versao: 1, vigenteDesde: new Date("2026-09-01T00:00:00.000Z"), vigenteAte: null,
        alunosPorBloco: 100, precoPorBlocoCentavos: 19900,
        blocosMinimosPorUnidade: 1, moeda: "BRL", recursos: {},
      }],
    });
    const auditCreate = vi.fn();
    const tx = { plano: { create }, auditLogPlataforma: { create: auditCreate } };
    const db = { $transaction: vi.fn(async (operacao) => operacao(tx)) };

    await new CriarPlanoService(db as never).execute({
      nome: "Profissional", vigenteDesde: new Date("2026-09-01T00:00:00.000Z"),
      alunosPorBloco: 100, precoPorBlocoCentavos: 19900,
      blocosMinimosPorUnidade: 1, moeda: "BRL", recursos: {},
      metadadosComerciais: { observacaoPrivada: "não auditar" },
    }, auditoria);

    expect(JSON.stringify(auditCreate.mock.calls[0][0])).not.toContain("observacaoPrivada");
  });
});
