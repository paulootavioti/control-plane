import { describe, expect, it } from "vitest";

import { formatarCentavos, formatarData, rotularStatus } from "./formatar";

// O separador entre "R$" e o número é um espaço NÃO SEPARÁVEL (U+00A0), que é
// o que `toLocaleString("pt-BR")` produz. Escrito como espaço comum, a
// comparação falha por um caractere invisível — daí o \u00a0 explícito.
const REAL = "R$\u00a0";

describe("formatarCentavos", () => {
  it("converte centavos em reais", () => {
    expect(formatarCentavos(3700)).toBe(`${REAL}37,00`);
    expect(formatarCentavos(11100)).toBe(`${REAL}111,00`);
  });

  it("mostra zero como valor, não como vazio", () => {
    expect(formatarCentavos(0)).toBe(`${REAL}0,00`);
  });

  it("preserva os centavos que não fecham em real inteiro", () => {
    expect(formatarCentavos(3701)).toBe(`${REAL}37,01`);
    expect(formatarCentavos(1)).toBe(`${REAL}0,01`);
  });
});

describe("formatarData", () => {
  // Datas de calendário são formatadas em UTC. Sem isso, uma data anotada como
  // 01/03 apareceria como 28/02 para quem está a oeste de Greenwich.
  it("não deixa o dia mudar conforme o fuso de quem consulta", () => {
    expect(formatarData("2026-03-01T00:00:00.000Z")).toBe("01/03/2026");
  });

  it("formata no padrão brasileiro", () => {
    expect(formatarData("2026-08-17T15:30:00.000Z")).toBe("17/08/2026");
  });

  it("mostra travessão quando não há data", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData(undefined)).toBe("—");
    expect(formatarData("")).toBe("—");
  });

  it("mostra travessão quando a data é inválida", () => {
    expect(formatarData("qualquer coisa")).toBe("—");
  });
});

describe("rotularStatus", () => {
  it("traduz os status conhecidos", () => {
    expect(rotularStatus("EM_PROVISIONAMENTO")).toBe("Em provisionamento");
    expect(rotularStatus("ERRO_PROVISIONAMENTO")).toBe("Erro no provisionamento");
  });

  // Um estado novo na API precisa aparecer, ainda que sem tradução. Devolver
  // vazio esconderia a informação justamente quando ela é inesperada.
  it("mostra o status cru quando não conhece a tradução", () => {
    expect(rotularStatus("ALGO_NOVO")).toBe("ALGO_NOVO");
  });
});
