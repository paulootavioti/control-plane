import { describe, expect, it } from "vitest";
import { chaveRateLimit } from "./chaveRateLimit";

function requisicao(cabecalhos: Record<string, string> = {}, remoteAddress?: string) {
  return { header: (nome: string) => cabecalhos[nome.toLowerCase()], socket: { remoteAddress } } as never;
}

describe("chave do rate limit no Netlify", () => {
  it("prioriza o IP normalizado pelo Netlify", () => {
    expect(chaveRateLimit(requisicao({ "x-nf-client-connection-ip": "203.0.113.10" }, "127.0.0.1"))).toBe("203.0.113.10");
  });
  it("não aceita valor arbitrário como IP", () => {
    expect(chaveRateLimit(requisicao({ "x-nf-client-connection-ip": "forjado" }, "127.0.0.1"))).toBe("127.0.0.1");
  });
  it("falha para uma chave compartilhada quando o adaptador não fornece IP", () => {
    expect(chaveRateLimit(requisicao())).toBe("cliente-sem-ip");
  });
});
