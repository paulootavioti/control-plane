import { z } from "zod";

const padraoSegredo = /^[a-zA-Z0-9/_+=.@-]+$/;

export const inventarioAmbienteSchema = z.object({
  provider: z.literal("NEON"),
  regiao: z.string().trim().min(2).max(80),
  providerProjectId: z.string().trim().min(1).max(200).nullish(),
  providerBranchId: z.string().trim().min(1).max(200).nullish(),
  providerEndpointId: z.string().trim().min(1).max(200).nullish(),
  databaseName: z.string().trim().min(1).max(63).nullish(),
  roleName: z.string().trim().min(1).max(63).nullish(),
  postgresVersion: z.number().int().min(16).nullish(),
  secretRef: z.string().trim().regex(padraoSegredo).max(500).nullish(),
  credentialVersion: z.number().int().positive().nullish(),
  schemaVersaoDesejada: z.string().trim().min(1).max(100),
});

const SEGREDOS = [
  /postgres(?:ql)?:\/\/\S+/gi,
  /(?:password|senha|token|secret)\s*[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
];

export function sanitizarErroProvisionamento(erro: unknown): string {
  const original = erro instanceof Error ? erro.message : String(erro);
  return SEGREDOS.reduce((texto, padrao) => texto.replace(padrao, "[REDACTED]"), original)
    .slice(0, 2000);
}
