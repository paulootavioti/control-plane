import { describe, expect, it } from "vitest";

import {
  assinaturaSchema,
  competenciaSchema,
  planoVersaoSchema,
} from "./regrasComerciais";

describe("regras comerciais", () => {
  it("aceita uma versão de plano válida", () => {
    const resultado = planoVersaoSchema.safeParse({
      alunosPorBloco: 10,
      precoPorBlocoCentavos: 3700,
      blocosMinimosPorUnidade: 1,
      moeda: "BRL",
      vigenteDesde: new Date("2026-08-01T00:00:00.000Z"),
      recursos: { WHATSAPP: true },
    });

    expect(resultado.success).toBe(true);
  });

  it("recusa fim de vigência anterior ao início", () => {
    const resultado = planoVersaoSchema.safeParse({
      alunosPorBloco: 10,
      precoPorBlocoCentavos: 3700,
      moeda: "BRL",
      vigenteDesde: new Date("2026-08-10T00:00:00.000Z"),
      vigenteAte: new Date("2026-08-01T00:00:00.000Z"),
      recursos: {},
    });

    expect(resultado.success).toBe(false);
  });

  it("limita o vencimento ao dia 28", () => {
    expect(assinaturaSchema.safeParse({ diaVencimento: 28 }).success).toBe(true);
    expect(assinaturaSchema.safeParse({ diaVencimento: 29 }).success).toBe(false);
  });

  it("aceita somente competências no formato AAAA-MM", () => {
    expect(competenciaSchema.safeParse("2026-08").success).toBe(true);
    expect(competenciaSchema.safeParse("2026-13").success).toBe(false);
    expect(competenciaSchema.safeParse("08/2026").success).toBe(false);
  });
});
