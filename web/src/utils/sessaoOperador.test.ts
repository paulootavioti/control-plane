import { beforeEach, describe, expect, it } from "vitest";

import type { Operador } from "../contexts/authContextData";
import { instalarStoragesDeTeste } from "../testing/storagesDeTeste";
import {
  CHAVE_OPERADOR,
  CHAVE_TOKEN,
  gravarSessao,
  lerSessao,
  limparSessao,
  perfilAlcanca,
} from "./sessaoOperador";

const storage = instalarStoragesDeTeste();

const operador: Operador = {
  id: "0f1b6b8e-2a3f-4a52-9d5f-3f7b2c1a9e10",
  nome: "Paulo",
  email: "paulo@exemplo.com",
  perfil: "ADMIN_PLATAFORMA",
};

beforeEach(() => storage.limpar());

describe("lerSessao", () => {
  it("devolve sessão vazia quando nunca houve login", () => {
    expect(lerSessao()).toEqual({ operador: null, token: null });
  });

  it("restaura o que foi gravado", () => {
    gravarSessao(operador, "jwt");

    expect(lerSessao()).toEqual({ operador, token: "jwt" });
  });

  // Token sem operador deixaria o app "logado" sem saber quem é nem o que
  // pode ver — e `podeVer` decidiria com base em `undefined`.
  it("recusa a sessão quando só o token sobreviveu", () => {
    storage.escreverCru(CHAVE_TOKEN, "jwt");

    expect(lerSessao()).toEqual({ operador: null, token: null });
  });

  it("recusa a sessão quando só o operador sobreviveu", () => {
    storage.escreverCru(CHAVE_OPERADOR, JSON.stringify(operador));

    expect(lerSessao()).toEqual({ operador: null, token: null });
  });

  it("recusa operador com perfil que não existe", () => {
    storage.escreverCru(CHAVE_OPERADOR, JSON.stringify({ ...operador, perfil: "DONO" }));
    storage.escreverCru(CHAVE_TOKEN, "jwt");

    expect(lerSessao()).toEqual({ operador: null, token: null });
  });

  it("recusa operador sem os campos esperados", () => {
    storage.escreverCru(CHAVE_OPERADOR, JSON.stringify({ nome: "Sem id" }));
    storage.escreverCru(CHAVE_TOKEN, "jwt");

    expect(lerSessao()).toEqual({ operador: null, token: null });
  });

  it("não lança quando o conteúdo não é JSON", () => {
    storage.escreverCru(CHAVE_OPERADOR, "não é json");
    storage.escreverCru(CHAVE_TOKEN, "jwt");

    expect(() => lerSessao()).not.toThrow();
    expect(lerSessao().operador).toBeNull();
  });
});

describe("limparSessao", () => {
  it("não deixa resquício", () => {
    gravarSessao(operador, "jwt");

    limparSessao();

    expect(localStorage.getItem(CHAVE_OPERADOR)).toBeNull();
    expect(localStorage.getItem(CHAVE_TOKEN)).toBeNull();
  });
});

describe("perfilAlcanca", () => {
  it("libera qualquer perfil autenticado quando nenhum é exigido", () => {
    expect(perfilAlcanca("SUPORTE", [])).toBe(true);
  });

  it("libera o perfil listado", () => {
    expect(perfilAlcanca("FINANCEIRO", ["FINANCEIRO", "ADMIN_PLATAFORMA"])).toBe(true);
  });

  it("barra o perfil de fora da lista", () => {
    expect(perfilAlcanca("SUPORTE", ["FINANCEIRO", "ADMIN_PLATAFORMA"])).toBe(false);
  });

  // ADMIN_PLATAFORMA não é curinga: as rotas do backend o listam explicitamente
  // quando ele deve passar. Tratá-lo como curinga aqui mostraria telas que o
  // servidor recusaria.
  it("não trata o administrador como curinga", () => {
    expect(perfilAlcanca("ADMIN_PLATAFORMA", ["SUPORTE"])).toBe(false);
  });

  it("barra quem não tem perfil", () => {
    expect(perfilAlcanca(undefined, [])).toBe(false);
    expect(perfilAlcanca(undefined, ["ADMIN_PLATAFORMA"])).toBe(false);
  });
});
