import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import { assinarConcessao, extrairRecursos, statusAcesso } from "./concessaoContrato";

describe("emissão da concessão", () => {
  it("assina um payload verificável pelo tenant", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const payload = {
      versao: 1 as const,
      tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d",
      revisao: 2,
      statusAcesso: "ATIVO" as const,
      recursos: ["WHATSAPP" as const],
      emitidaEm: "2026-08-12T12:00:00.000Z",
      expiraEm: "2026-08-13T12:00:00.000Z",
    };
    const concessao = assinarConcessao(payload, privateKey.export({ type: "pkcs8", format: "pem" }).toString());
    const canonico = JSON.stringify(payload, Object.keys(payload).sort());
    expect(verify(null, Buffer.from(canonico), publicKey, Buffer.from(concessao.assinatura, "base64"))).toBe(true);
  });

  it("libera somente recursos conhecidos marcados como true", () => {
    expect(extrairRecursos({ WHATSAPP: true, CONTROLE_ACESSO: false, DESCONHECIDO: true }))
      .toEqual(["WHATSAPP"]);
  });

  it("mapeia atraso sem corte automático e suspensão com bloqueio", () => {
    expect(statusAcesso("INADIMPLENTE")).toBe("ATIVO");
    expect(statusAcesso("SUSPENSA")).toBe("SUSPENSO");
    expect(statusAcesso("CANCELADA")).toBe("CANCELADO");
  });
});
