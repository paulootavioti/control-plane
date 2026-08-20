import { beforeEach, describe, expect, it } from "vitest";

import { instalarStoragesDeTeste } from "../testing/storagesDeTeste";
import {
  MENSAGEM_SESSAO_EXPIRADA,
  lerSessaoExpirada,
  limparSessaoExpirada,
  marcarSessaoExpirada,
} from "./sessaoExpirada";

const storage = instalarStoragesDeTeste();

beforeEach(() => storage.limpar());

describe("aviso de sessão expirada", () => {
  it("não avisa nada quando ninguém marcou", () => {
    expect(lerSessaoExpirada()).toBeNull();
  });

  it("avisa depois de a sessão ser recusada pelo backend", () => {
    marcarSessaoExpirada();

    expect(lerSessaoExpirada()).toBe(MENSAGEM_SESSAO_EXPIRADA);
  });

  // Ler não pode consumir: o inicializador de useState é chamado duas vezes em
  // modo estrito, e a segunda chamada encontraria a marca já apagada.
  it("continua avisando em leituras repetidas", () => {
    marcarSessaoExpirada();

    expect(lerSessaoExpirada()).toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(lerSessaoExpirada()).toBe(MENSAGEM_SESSAO_EXPIRADA);
  });

  it("para de avisar depois de limpar", () => {
    marcarSessaoExpirada();
    limparSessaoExpirada();

    expect(lerSessaoExpirada()).toBeNull();
  });

  it("limpar duas vezes não quebra", () => {
    marcarSessaoExpirada();
    limparSessaoExpirada();

    expect(() => limparSessaoExpirada()).not.toThrow();
    expect(lerSessaoExpirada()).toBeNull();
  });

  // O aviso pertence à aba em que a sessão caiu. No localStorage ele
  // reapareceria numa janela nova, dias depois, sem relação com o ocorrido.
  it("guarda a marca na sessão da aba, não no armazenamento persistente", () => {
    marcarSessaoExpirada();

    expect(sessionStorage.getItem("@sysbelt:sessaoExpirada")).toBe("1");
    expect(localStorage.getItem("@sysbelt:sessaoExpirada")).toBeNull();
  });
});
