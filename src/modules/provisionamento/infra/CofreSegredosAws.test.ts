import { GetSecretValueCommand, ResourceNotFoundException } from "@aws-sdk/client-secrets-manager";
import { describe, expect, it, vi } from "vitest";

import { CofreSegredosAws } from "./CofreSegredosAws";

describe("cofre AWS por tenant", () => {
  it("cria segredo com URLs e chave privada, retornando somente referência e pública", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new ResourceNotFoundException({ message: "ausente", $metadata: {} }))
      .mockResolvedValueOnce({ ARN: "arn:aws:secretsmanager:sa-east-1:123:secret:tenant" });
    const resultado = await new CofreSegredosAws({ send } as never).gravarOuValidar("tenant-1", {
      pooledUrl: "postgresql://pooled", directUrl: "postgresql://direct",
    });

    const comandoCriacao = send.mock.calls[1][0];
    const segredo = JSON.parse(comandoCriacao.input.SecretString);
    expect(segredo.integrationPrivateKey).toContain("BEGIN PRIVATE KEY");
    expect(resultado.chavePublicaIntegracao).toContain("BEGIN PUBLIC KEY");
    expect(JSON.stringify(resultado)).not.toContain("postgresql://");
    expect(JSON.stringify(resultado)).not.toContain("PRIVATE KEY");
  });

  it("relê segredo existente sem criar nova versão", async () => {
    const { gerarParChavesIntegracao } = await import("../worker/materialIntegracao");
    const par = gerarParChavesIntegracao();
    const send = vi.fn().mockResolvedValue({
      ARN: "arn:existente",
      SecretString: JSON.stringify({ tenantKey: "tenant-1", integrationPrivateKey: par.chavePrivadaPem }),
    });
    const resultado = await new CofreSegredosAws({ send } as never).gravarOuValidar("tenant-1", {
      pooledUrl: "ignorada", directUrl: "ignorada",
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetSecretValueCommand);
    expect(resultado.secretRef).toBe("arn:existente");
  });
});
