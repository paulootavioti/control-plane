import { describe, expect, it } from "vitest";

import { calcularBlocos, valoresVigentes, type Assinatura } from "./valoresDaAssinatura";

const assinatura = (negociados: Partial<Assinatura> = {}): Assinatura => ({
  id: "a1",
  status: "ATIVA",
  inicioEm: "2026-01-01T00:00:00.000Z",
  testeAte: null,
  canceladaEm: null,
  diaVencimento: 10,
  alunosPorBlocoNegociado: null,
  precoPorBlocoCentavosNegociado: null,
  blocosMinimosPorUnidadeNegociado: null,
  planoVersao: {
    id: "pv1",
    versao: 1,
    alunosPorBloco: 10,
    precoPorBlocoCentavos: 3700,
    blocosMinimosPorUnidade: 1,
    moeda: "BRL",
    recursos: {},
    plano: { id: "p1", nome: "Essencial", descricao: null },
  },
  ...negociados,
});

describe("valoresVigentes", () => {
  it("usa o valor de tabela quando não há negociação", () => {
    const valores = valoresVigentes(assinatura());

    expect(valores.precoPorBlocoCentavos).toEqual({ valor: 3700, negociado: false });
    expect(valores.alunosPorBloco).toEqual({ valor: 10, negociado: false });
    expect(valores.blocosMinimosPorUnidade).toEqual({ valor: 1, negociado: false });
  });

  it("usa o valor negociado quando ele existe", () => {
    const valores = valoresVigentes(assinatura({ precoPorBlocoCentavosNegociado: 2900 }));

    expect(valores.precoPorBlocoCentavos).toEqual({ valor: 2900, negociado: true });
    // os demais continuam vindo do plano
    expect(valores.alunosPorBloco.negociado).toBe(false);
  });

  it("negocia campo a campo, não em bloco", () => {
    const valores = valoresVigentes(
      assinatura({ alunosPorBlocoNegociado: 15, blocosMinimosPorUnidadeNegociado: 2 })
    );

    expect(valores.alunosPorBloco).toEqual({ valor: 15, negociado: true });
    expect(valores.blocosMinimosPorUnidade).toEqual({ valor: 2, negociado: true });
    expect(valores.precoPorBlocoCentavos).toEqual({ valor: 3700, negociado: false });
  });

  // A API recusa zero, então isto trava a defesa, não um caso de uso: um zero
  // que chegue por outro caminho precisa aparecer como zero. Tratado como "sem
  // negociação", a tela mostraria R$ 37,00 para uma assinatura que diz 0.
  it("mostra zero gravado em vez de cair no preço de tabela", () => {
    const valores = valoresVigentes(assinatura({ precoPorBlocoCentavosNegociado: 0 }));

    expect(valores.precoPorBlocoCentavos).toEqual({ valor: 0, negociado: true });
  });
});

describe("calcularBlocos", () => {
  it("cobra uma faixa a cada dez alunos", () => {
    expect(calcularBlocos([10], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(1);
    expect(calcularBlocos([20], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(2);
  });

  it("arredonda para cima a fração de faixa", () => {
    expect(calcularBlocos([11], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(2);
    expect(calcularBlocos([1], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(1);
  });

  // A regra é por unidade, não sobre o total. 12 e 8 dão 2+1=3 faixas; somados
  // (20 alunos) dariam 2 — e a academia pagaria menos do que o contratado.
  it("conta por unidade, não sobre o total da academia", () => {
    expect(calcularBlocos([12, 8], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(3);
    expect(calcularBlocos([20], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(2);
  });

  it("cobra o mínimo por unidade mesmo sem alunos", () => {
    expect(calcularBlocos([0, 0], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(2);
  });

  it("respeita um mínimo por unidade maior que um", () => {
    expect(calcularBlocos([5], { alunosPorBloco: 10, blocosMinimosPorUnidade: 3 })).toBe(3);
    expect(calcularBlocos([45], { alunosPorBloco: 10, blocosMinimosPorUnidade: 3 })).toBe(5);
  });

  it("devolve zero quando não há unidade nenhuma", () => {
    expect(calcularBlocos([], { alunosPorBloco: 10, blocosMinimosPorUnidade: 1 })).toBe(0);
  });

  // Aritmética inteira em vez de Math.ceil sobre divisão em ponto flutuante:
  // uma faixa a mais é dinheiro cobrado a mais do cliente.
  it("não cria faixa extra em divisões que o binário não representa exato", () => {
    for (const alunos of [3, 6, 7, 9, 21, 33, 70, 700, 7000]) {
      const porBloco = 7;
      expect(calcularBlocos([alunos], { alunosPorBloco: porBloco, blocosMinimosPorUnidade: 1 })).toBe(
        Math.ceil(alunos / porBloco)
      );
    }
  });
});
