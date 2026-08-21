import { describe, expect, it } from "vitest";
import { obterProduto, PRODUTOS } from "./catalogoProdutos";

describe("catálogo de produtos", () => {
  it("mantém o acesso clínico do Psyché separado da suspensão administrativa", () => {
    expect(PRODUTOS.psyche.politicaAcessoInadimplencia)
      .toBe("SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO");
  });

  it("recusa produto não registrado", () => {
    expect(() => obterProduto("desconhecido")).toThrow("PRODUTO_NAO_SUPORTADO");
  });
});
