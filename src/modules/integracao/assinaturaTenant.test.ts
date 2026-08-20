import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ContagemContratoV1 } from "./contagemContrato";
import { mensagemAssinada, verificarAssinaturaTenant } from "./assinaturaTenant";

const payload: ContagemContratoV1 = {
  versao: 1,
  eventoId: "bd33b13d-1c77-45ba-a937-85d03c98d24a",
  tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d",
  dataCorte: "2026-08-12T12:00:00.000Z",
  unidades: [{ unidadeId: "u1", nomeExibicao: "Matriz", status: "ATIVA", alunosAtivos: 10 }],
};

describe("assinatura do tenant", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const timestamp = "2026-08-12T12:01:00.000Z";
  const assinatura = sign(null, Buffer.from(mensagemAssinada(timestamp, payload)), privateKey).toString("base64");

  it("aceita payload assinado pela chave privada correspondente", () => {
    expect(verificarAssinaturaTenant({
      payload, timestamp, assinaturaBase64: assinatura,
      chavePublica: publicKey.export({ type: "spki", format: "pem" }).toString(),
      agora: new Date("2026-08-12T12:02:00.000Z"),
    })).toBe(true);
  });

  it("recusa alteração posterior e timestamp antigo", () => {
    const chavePublica = publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(verificarAssinaturaTenant({
      payload: { ...payload, unidades: [{ ...payload.unidades[0], alunosAtivos: 11 }] },
      timestamp, assinaturaBase64: assinatura, chavePublica,
      agora: new Date("2026-08-12T12:02:00.000Z"),
    })).toBe(false);
    expect(verificarAssinaturaTenant({
      payload, timestamp, assinaturaBase64: assinatura, chavePublica,
      agora: new Date("2026-08-12T12:07:00.000Z"),
    })).toBe(false);
  });
});
