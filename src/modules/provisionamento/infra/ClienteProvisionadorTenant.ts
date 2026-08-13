import { z } from "zod";

import { EventoParaProcessar } from "../worker/contratos";

const respostaMigrationSchema = z.object({ schemaVersaoAtual: z.string().trim().min(1).max(100) }).strict();
type Operacao = "APLICAR_MIGRATIONS" | "EXECUTAR_BOOTSTRAP" | "VALIDAR_SAUDE";

// Contrato canônico: contracts/control-plane-provisioner/v1/operacao.schema.json

export class ClienteProvisionadorTenant {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async aplicarMigrations(evento: EventoParaProcessar, secretRef: string): Promise<string> {
    const resposta = await this.executar("APLICAR_MIGRATIONS", evento, secretRef);
    return respostaMigrationSchema.parse(resposta).schemaVersaoAtual;
  }

  async executarBootstrap(evento: EventoParaProcessar, secretRef: string): Promise<void> {
    await this.executar("EXECUTAR_BOOTSTRAP", evento, secretRef);
  }

  async validarSaude(evento: EventoParaProcessar, secretRef: string): Promise<void> {
    await this.executar("VALIDAR_SAUDE", evento, secretRef);
  }

  private async executar(operacao: Operacao, evento: EventoParaProcessar, secretRef: string): Promise<unknown> {
    const resposta = await this.http(`${this.baseUrl.replace(/\/$/, "")}/v1/tenants/operacoes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "x-idempotency-key": `${evento.chaveIdempotencia}:${operacao}`,
      },
      body: JSON.stringify({ operacao, tenantKey: evento.tenantKey, secretRef }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!resposta.ok) throw new Error(`Provisionador de tenants respondeu com status ${resposta.status}.`);
    if (resposta.status === 204) return {};
    return resposta.json();
  }
}
