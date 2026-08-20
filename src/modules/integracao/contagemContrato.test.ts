import { describe, expect, it } from "vitest";

import { contagemContratoV1Schema } from "./contagemContrato";

const payload = {
  versao: 1 as const,
  eventoId: "bd33b13d-1c77-45ba-a937-85d03c98d24a",
  tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d",
  dataCorte: "2026-08-12T12:00:00.000Z",
  unidades: [{ unidadeId: "unidade-1", nomeExibicao: "Matriz", status: "ATIVA" as const, alunosAtivos: 42 }],
};

describe("contrato de contagem v1", () => {
  it("aceita somente dados agregados por unidade", () => {
    expect(contagemContratoV1Schema.safeParse(payload).success).toBe(true);
  });

  it("recusa campos extras que poderiam carregar dados pessoais", () => {
    const resultado = contagemContratoV1Schema.safeParse({
      ...payload,
      unidades: [{ ...payload.unidades[0], alunos: [{ nome: "Não deve sair do tenant" }] }],
    });
    expect(resultado.success).toBe(false);
  });

  it("recusa unidade duplicada e contagem negativa", () => {
    expect(contagemContratoV1Schema.safeParse({
      ...payload,
      unidades: [payload.unidades[0], { ...payload.unidades[0], alunosAtivos: -1 }],
    }).success).toBe(false);
  });
});
