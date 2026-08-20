import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";

import { criarInterceptorDeExpiracao, ehSessaoExpirada } from "./expiracaoDeSessao";

function respostaComStatus(status: number, url = "/assinantes") {
  const erro = new AxiosError("Request failed");
  erro.config = { headers: new AxiosHeaders(), url };
  erro.response = {
    status,
    statusText: "",
    data: {},
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return erro;
}

describe("ehSessaoExpirada", () => {
  it("reconhece o 401", () => {
    expect(ehSessaoExpirada(respostaComStatus(401))).toBe(true);
  });

  // 403 é falta de permissão com sessão válida: deslogar aqui expulsaria quem
  // apenas tentou abrir uma tela que não é do perfil dele.
  it("não trata falta de permissão como sessão expirada", () => {
    expect(ehSessaoExpirada(respostaComStatus(403))).toBe(false);
  });

  it("não trata erro de validação como sessão expirada", () => {
    expect(ehSessaoExpirada(respostaComStatus(400))).toBe(false);
  });

  it("não trata erro do servidor como sessão expirada", () => {
    expect(ehSessaoExpirada(respostaComStatus(500))).toBe(false);
  });

  // Sem resposta, o servidor não disse nada sobre a sessão — derrubar o
  // usuário por causa de um túnel ruim perderia a sessão dele sem motivo.
  it("não trata falta de conexão como sessão expirada", () => {
    expect(ehSessaoExpirada(new AxiosError("Network Error"))).toBe(false);
  });

  // O Control Plane devolve 401 para senha errada, ao contrário da API do
  // tenant, que devolve 400. Sem esta exceção, um login recusado marcaria a
  // sessão como expirada e o aviso apareceria sem que sessão alguma tivesse
  // existido.
  it("não trata login recusado como sessão expirada", () => {
    expect(ehSessaoExpirada(respostaComStatus(401, "/auth/login"))).toBe(false);
  });

  it("continua tratando 401 das demais rotas como sessão expirada", () => {
    expect(ehSessaoExpirada(respostaComStatus(401, "/assinantes"))).toBe(true);
    expect(ehSessaoExpirada(respostaComStatus(401, "/dashboard/resumo"))).toBe(true);
  });

  it("ignora o que não é erro do Axios", () => {
    expect(ehSessaoExpirada(new Error("qualquer coisa"))).toBe(false);
    expect(ehSessaoExpirada(undefined)).toBe(false);
  });
});

describe("criarInterceptorDeExpiracao", () => {
  it("avisa uma vez quando a sessão expira", async () => {
    const aoExpirar = vi.fn();
    const interceptor = criarInterceptorDeExpiracao(aoExpirar);

    await expect(interceptor(respostaComStatus(401))).rejects.toBeDefined();
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it("não avisa nos demais erros", async () => {
    const aoExpirar = vi.fn();
    const interceptor = criarInterceptorDeExpiracao(aoExpirar);

    await expect(interceptor(respostaComStatus(403))).rejects.toBeDefined();
    await expect(interceptor(new AxiosError("Network Error"))).rejects.toBeDefined();
    expect(aoExpirar).not.toHaveBeenCalled();
  });

  // Quem chamou precisa continuar recebendo a falha: engolir o erro deixaria a
  // tela esperando para sempre por uma resposta que não vem.
  it("repassa o erro original a quem fez a chamada", async () => {
    const erro = respostaComStatus(401);
    const interceptor = criarInterceptorDeExpiracao(vi.fn());

    await expect(interceptor(erro)).rejects.toBe(erro);
  });
});
