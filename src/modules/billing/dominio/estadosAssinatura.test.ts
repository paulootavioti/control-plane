import { describe, expect, it } from "vitest";
import { calcularEfeitoAcesso, validarTransicao } from "./estadosAssinatura";

describe("máquina de estados da assinatura", () => {
  it.each([
    ["TRIAL", "ATIVA"], ["ATIVA", "INADIMPLENTE"], ["INADIMPLENTE", "SUSPENSA"],
    ["INADIMPLENTE", "ATIVA"], ["SUSPENSA", "ATIVA"], ["ATIVA", "CANCELADA"],
  ] as const)("aceita %s → %s", (origem, destino) => {
    expect(() => validarTransicao(origem, destino)).not.toThrow();
  });

  it("não permite reativar assinatura cancelada", () => {
    expect(() => validarTransicao("CANCELADA", "ATIVA"))
      .toThrow("TRANSICAO_ASSINATURA_INVALIDA");
  });

  it("nunca bloqueia acesso clínico do Psyché por inadimplência", () => {
    expect(calcularEfeitoAcesso("psyche", "SUSPENSA")).toEqual({
      acessoAdministrativo: "RESTRITO_REGULARIZACAO",
      acessoClinico: "LIBERADO",
      excluirDados: false,
    });
  });
});
