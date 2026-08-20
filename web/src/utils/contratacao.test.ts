import { describe, expect, it } from "vitest";

import {
  CONTRATACAO_VAZIA,
  montarCorpo,
  motivoParaNaoContratar,
  reaisParaCentavos,
  validarContratacao,
  type FormularioContratacao,
} from "./contratacao";

const AGORA = new Date("2026-08-18T12:00:00.000Z");

const formulario = (mudancas: Partial<FormularioContratacao> = {}): FormularioContratacao => ({
  ...CONTRATACAO_VAZIA,
  planoVersaoId: "3f1b6b8e-2a3f-4a52-9d5f-3f7b2c1a9e10",
  ...mudancas,
});

const campos = (f: FormularioContratacao) =>
  validarContratacao(f, AGORA).map((problema) => problema.campo);

describe("reaisParaCentavos", () => {
  it("converte reais em centavos", () => {
    expect(reaisParaCentavos("37")).toBe(3700);
    expect(reaisParaCentavos("37.00")).toBe(3700);
  });

  it("aceita vírgula como separador decimal", () => {
    expect(reaisParaCentavos("29,90")).toBe(2990);
  });

  // 29.9 * 100 dá 2989.9999999999995 em ponto flutuante. Truncar cobraria um
  // centavo a menos do que foi combinado com o cliente.
  it("não perde centavo em valores que o binário não representa exato", () => {
    expect(reaisParaCentavos("29.9")).toBe(2990);
    expect(reaisParaCentavos("1.1")).toBe(110);
    expect(reaisParaCentavos("8.7")).toBe(870);
  });

  it("trata campo em branco como ausência de negociação", () => {
    expect(reaisParaCentavos("")).toBeUndefined();
    expect(reaisParaCentavos("   ")).toBeUndefined();
  });

  it("devolve NaN para texto que não é número", () => {
    expect(reaisParaCentavos("abc")).toBeNaN();
  });
});

describe("validarContratacao", () => {
  it("aceita o caminho simples", () => {
    expect(validarContratacao(formulario(), AGORA)).toEqual([]);
  });

  it("exige o plano", () => {
    expect(campos(formulario({ planoVersaoId: "" }))).toContain("planoVersaoId");
  });

  // O teto é 28 para que a data exista em todo mês, fevereiro incluído.
  it("recusa dia de vencimento fora de 1 a 28", () => {
    expect(campos(formulario({ diaVencimento: "0" }))).toContain("diaVencimento");
    expect(campos(formulario({ diaVencimento: "29" }))).toContain("diaVencimento");
    expect(campos(formulario({ diaVencimento: "31" }))).toContain("diaVencimento");
    expect(campos(formulario({ diaVencimento: "10.5" }))).toContain("diaVencimento");
    expect(campos(formulario({ diaVencimento: "" }))).toContain("diaVencimento");
  });

  it("aceita os extremos do dia de vencimento", () => {
    expect(campos(formulario({ diaVencimento: "1" }))).toEqual([]);
    expect(campos(formulario({ diaVencimento: "28" }))).toEqual([]);
  });

  describe("período de teste", () => {
    it("exige a data quando o status é TESTE", () => {
      expect(campos(formulario({ status: "TESTE" }))).toContain("testeAte");
    });

    it("exige que a data seja futura", () => {
      expect(campos(formulario({ status: "TESTE", testeAte: "2026-08-01" }))).toContain("testeAte");
      expect(campos(formulario({ status: "TESTE", testeAte: "2026-09-30" }))).toEqual([]);
    });

    it("ignora a data quando o status é ATIVA", () => {
      expect(campos(formulario({ status: "ATIVA", testeAte: "" }))).toEqual([]);
    });
  });

  describe("valores negociados", () => {
    it("aceita campos em branco como ausência de negociação", () => {
      expect(campos(formulario())).toEqual([]);
    });

    it("aceita valores positivos", () => {
      expect(
        campos(
          formulario({
            alunosPorBlocoNegociado: "15",
            precoPorBlocoNegociadoReais: "29,00",
            blocosMinimosNegociado: "2",
          })
        )
      ).toEqual([]);
    });

    // O backend valida `z.number().int().positive()`, que recusa zero. Sem
    // dizer isso aqui, o operador preenche o formulário inteiro e recebe um
    // 400 genérico.
    it("recusa zero, que o backend não aceita", () => {
      expect(campos(formulario({ alunosPorBlocoNegociado: "0" }))).toContain("alunosPorBlocoNegociado");
      expect(campos(formulario({ precoPorBlocoNegociadoReais: "0" }))).toContain("precoPorBlocoNegociadoReais");
      expect(campos(formulario({ blocosMinimosNegociado: "0" }))).toContain("blocosMinimosNegociado");
    });

    it("recusa negativos e texto", () => {
      expect(campos(formulario({ alunosPorBlocoNegociado: "-3" }))).toContain("alunosPorBlocoNegociado");
      expect(campos(formulario({ alunosPorBlocoNegociado: "abc" }))).toContain("alunosPorBlocoNegociado");
      expect(campos(formulario({ precoPorBlocoNegociadoReais: "abc" }))).toContain("precoPorBlocoNegociadoReais");
    });

    it("recusa fração em campos que contam unidades", () => {
      expect(campos(formulario({ alunosPorBlocoNegociado: "10.5" }))).toContain("alunosPorBlocoNegociado");
    });

    // Preço em reais com centavos é legítimo — vira inteiro em centavos.
    it("aceita centavos no preço", () => {
      expect(campos(formulario({ precoPorBlocoNegociadoReais: "29,90" }))).toEqual([]);
    });
  });
});

describe("montarCorpo", () => {
  it("envia o mínimo quando não há negociação", () => {
    expect(montarCorpo(formulario())).toEqual({
      planoVersaoId: "3f1b6b8e-2a3f-4a52-9d5f-3f7b2c1a9e10",
      status: "ATIVA",
      diaVencimento: 10,
    });
  });

  // Campo em branco precisa ficar FORA do corpo. Enviado como null, o backend
  // recusa — os campos negociados são `nullish()` no schema, mas o serviço
  // trata ausência e null de formas diferentes.
  it("omite os campos negociados em branco em vez de enviar nulo", () => {
    const corpo = montarCorpo(formulario());

    expect("alunosPorBlocoNegociado" in corpo).toBe(false);
    expect("precoPorBlocoCentavosNegociado" in corpo).toBe(false);
    expect("blocosMinimosPorUnidadeNegociado" in corpo).toBe(false);
    expect("testeAte" in corpo).toBe(false);
  });

  it("converte o preço negociado para centavos", () => {
    const corpo = montarCorpo(formulario({ precoPorBlocoNegociadoReais: "29,90" }));

    expect(corpo.precoPorBlocoCentavosNegociado).toBe(2990);
  });

  it("envia a data de teste em ISO, ancorada em meia-noite UTC", () => {
    const corpo = montarCorpo(formulario({ status: "TESTE", testeAte: "2026-09-30" }));

    expect(corpo.testeAte).toBe("2026-09-30T00:00:00.000Z");
  });

  it("não envia data de teste quando a assinatura já nasce ativa", () => {
    const corpo = montarCorpo(formulario({ status: "ATIVA", testeAte: "2026-09-30" }));

    expect("testeAte" in corpo).toBe(false);
  });
});

describe("motivoParaNaoContratar", () => {
  it("libera assinante em prospecção sem assinatura", () => {
    expect(motivoParaNaoContratar({ status: "PROSPECT", assinatura: null })).toBeNull();
  });

  it("barra quem já tem assinatura vigente", () => {
    expect(motivoParaNaoContratar({ status: "PROSPECT", assinatura: { id: "x" } })).toMatch(/já tem assinatura/);
  });

  it("barra quem não está em prospecção", () => {
    expect(motivoParaNaoContratar({ status: "ATIVO", assinatura: null })).toMatch(/prospecção/);
    expect(motivoParaNaoContratar({ status: "CANCELADO", assinatura: null })).toMatch(/prospecção/);
  });

  // A assinatura vigente é a razão mais específica: dizer "não está em
  // prospecção" quando o problema é a assinatura mandaria o operador olhar o
  // campo errado.
  it("prefere a razão mais específica quando as duas se aplicam", () => {
    expect(motivoParaNaoContratar({ status: "ATIVO", assinatura: { id: "x" } })).toMatch(/já tem assinatura/);
  });
});
