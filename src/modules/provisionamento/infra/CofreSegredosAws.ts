import {
  CreateSecretCommand,
  GetSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

import { gerarParChavesIntegracao } from "../worker/materialIntegracao";
import { SegredoTenantRegistrado } from "../worker/contratos";

type DadosBancoTenant = { pooledUrl: string; directUrl: string };
type ClienteSegredos = Pick<SecretsManagerClient, "send">;

export class CofreSegredosAws {
  constructor(
    private readonly cliente: ClienteSegredos,
    private readonly prefixo = "sysbelt/prod/tenants",
    private readonly kmsKeyId?: string,
  ) {}

  async gravarOuValidar(tenantKey: string, banco: DadosBancoTenant): Promise<SegredoTenantRegistrado> {
    const nome = `${this.prefixo}/${tenantKey}/database`;
    try {
      const existente = await this.cliente.send(new GetSecretValueCommand({ SecretId: nome }));
      if (!existente.SecretString) throw new Error("Segredo do tenant não contém SecretString.");
      const dados = JSON.parse(existente.SecretString) as Record<string, unknown>;
      if (dados.tenantKey !== tenantKey || typeof dados.integrationPrivateKey !== "string") {
        throw new Error("Segredo existente não pertence ao tenant esperado.");
      }
      const { createPublicKey } = await import("node:crypto");
      return {
        secretRef: existente.ARN ?? nome,
        chavePublicaIntegracao: createPublicKey(dados.integrationPrivateKey).export({ type: "spki", format: "pem" }).toString(),
      };
    } catch (erro) {
      if (!(erro instanceof ResourceNotFoundException) && (erro as { name?: string }).name !== "ResourceNotFoundException") throw erro;
    }

    const par = gerarParChavesIntegracao();
    const criado = await this.cliente.send(new CreateSecretCommand({
      Name: nome,
      Description: `Credenciais exclusivas do Tenant Plane ${tenantKey}`,
      KmsKeyId: this.kmsKeyId,
      SecretString: JSON.stringify({
        tenantKey,
        pooledUrl: banco.pooledUrl,
        directUrl: banco.directUrl,
        credentialVersion: 1,
        integrationPrivateKey: par.chavePrivadaPem,
      }),
      Tags: [{ Key: "sysbelt:tenant-key", Value: tenantKey }, { Key: "sysbelt:managed-by", Value: "control-plane" }],
    }));
    return { secretRef: criado.ARN ?? nome, chavePublicaIntegracao: par.chavePublicaPem };
  }
}
