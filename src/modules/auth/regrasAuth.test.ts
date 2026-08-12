import { describe, expect, it } from "vitest";

import { conferirSenha, criarSenhaHash, emitirToken, loginSchema, verificarToken } from "./regrasAuth";

const segredo = "segredo-de-teste-com-pelo-menos-32-caracteres";

describe("autenticação de operador", () => {
  it("normaliza o e-mail no login", () => {
    const dados = loginSchema.parse({ email: " OPERADOR@SYSBELT.COM ", senha: "senha-segura" });
    expect(dados.email).toBe("operador@sysbelt.com");
  });

  it("armazena e confere senha por hash", async () => {
    const hash = await criarSenhaHash("senha-segura");
    expect(hash).not.toContain("senha-segura");
    await expect(conferirSenha("senha-segura", hash)).resolves.toBe(true);
    await expect(conferirSenha("senha-errada", hash)).resolves.toBe(false);
  });

  it("emite token vinculado ao operador, perfil e versão", () => {
    const token = emitirToken({ sub: "operador-1", perfil: "SUPORTE", versao: 2 }, segredo);
    expect(verificarToken(token, segredo)).toMatchObject({
      sub: "operador-1",
      perfil: "SUPORTE",
      versao: 2,
    });
  });
});
