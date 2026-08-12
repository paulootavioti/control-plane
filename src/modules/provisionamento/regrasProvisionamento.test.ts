import { describe, expect, it } from "vitest";

import { inventarioAmbienteSchema, sanitizarErroProvisionamento } from "./regrasProvisionamento";

describe("inventário de provisionamento", () => {
  it("aceita referência de segredo sem armazenar credencial", () => {
    expect(inventarioAmbienteSchema.safeParse({
      provider: "NEON",
      regiao: "aws-sa-east-1",
      secretRef: "sysbelt/prod/tenants/tenant-id/database",
      schemaVersaoDesejada: "20260812110000",
    }).success).toBe(true);
  });

  it("recusa connection string no lugar da referência", () => {
    expect(inventarioAmbienteSchema.safeParse({
      provider: "NEON",
      regiao: "aws-sa-east-1",
      secretRef: "postgresql://usuario:senha@host/banco",
      schemaVersaoDesejada: "1",
    }).success).toBe(false);
  });

  it("remove credenciais de erros antes da persistência", () => {
    const erro = sanitizarErroProvisionamento(
      new Error("Falhou postgresql://user:pass@host/db password=segredo token=abc"),
    );
    expect(erro).not.toContain("pass@host");
    expect(erro).not.toContain("segredo");
    expect(erro).not.toContain("abc");
  });
});
