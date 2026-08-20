import { generateKeyPairSync } from "node:crypto";

export type ParChavesIntegracao = {
  chavePublicaPem: string;
  chavePrivadaPem: string;
};

// Deve ser chamado dentro do adaptador do cofre. A chave privada retornada
// fica somente em memória até ser gravada como segredo e nunca é persistida
// no banco ou incluída no resultado do provisionamento.
export function gerarParChavesIntegracao(): ParChavesIntegracao {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    chavePublicaPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    chavePrivadaPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}
