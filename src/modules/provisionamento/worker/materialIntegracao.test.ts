import { createPublicKey, sign, verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import { gerarParChavesIntegracao } from "./materialIntegracao";

describe("material criptográfico do tenant", () => {
  it("gera par Ed25519 compatível sem confundir chave pública e privada", () => {
    const par = gerarParChavesIntegracao();
    const mensagem = Buffer.from("snapshot-agregado");
    const assinatura = sign(null, mensagem, par.chavePrivadaPem);

    expect(par.chavePrivadaPem).toContain("BEGIN PRIVATE KEY");
    expect(par.chavePublicaPem).toContain("BEGIN PUBLIC KEY");
    expect(par.chavePublicaPem).not.toContain("PRIVATE");
    expect(verify(null, mensagem, createPublicKey(par.chavePublicaPem), assinatura)).toBe(true);
  });

  it("gera pares distintos para academias diferentes", () => {
    expect(gerarParChavesIntegracao().chavePrivadaPem)
      .not.toBe(gerarParChavesIntegracao().chavePrivadaPem);
  });
});
