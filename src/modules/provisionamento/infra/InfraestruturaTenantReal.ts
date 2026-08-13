import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import { InfraestruturaTenant, EventoParaProcessar, ProjetoProvisionado } from "../worker/contratos";
import { ClienteNeon } from "./ClienteNeon";
import { ClienteProvisionadorTenant } from "./ClienteProvisionadorTenant";
import { CofreSegredosAws } from "./CofreSegredosAws";

function obrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`${nome} não configurada.`);
  return valor;
}

export function criarInfraestruturaTenantReal(): InfraestruturaTenant {
  const neon = new ClienteNeon(
    obrigatoria("NEON_API_KEY"), process.env.NEON_ORG_ID?.trim() || undefined,
    obrigatoria("NEON_REGION_ID"),
  );
  const cofre = new CofreSegredosAws(
    new SecretsManagerClient({ region: obrigatoria("AWS_REGION") }),
    process.env.AWS_SECRETS_PREFIX?.trim() || "sysbelt/prod/tenants",
    process.env.AWS_SECRETS_KMS_KEY_ID?.trim() || undefined,
  );
  const provisionador = new ClienteProvisionadorTenant(
    obrigatoria("TENANT_PROVISIONER_URL"), obrigatoria("TENANT_PROVISIONER_TOKEN"),
  );

  return {
    criarOuReconciliarProjeto: (evento) => neon.criarOuReconciliar(evento),
    gravarOuValidarSegredo: (evento: EventoParaProcessar, projeto: ProjetoProvisionado) =>
      cofre.gravarOuValidar(evento.tenantKey, projeto),
    aplicarMigrations: (evento, secretRef) => provisionador.aplicarMigrations(evento, secretRef),
    executarBootstrap: (evento, secretRef) => provisionador.executarBootstrap(evento, secretRef),
    validarSaude: (evento, secretRef) => provisionador.validarSaude(evento, secretRef),
  };
}
