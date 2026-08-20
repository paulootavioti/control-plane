import { z } from "zod";

import { EventoParaProcessar, ProjetoProvisionado } from "../worker/contratos";

const respostaCriacaoSchema = z.object({
  project: z.object({ id: z.string(), pg_version: z.number().int() }),
  branch: z.object({ id: z.string() }),
  endpoints: z.array(z.object({ id: z.string() })).min(1),
  roles: z.array(z.object({ name: z.string() })).min(1),
  databases: z.array(z.object({ name: z.string() })).min(1),
  connection_uris: z.array(z.object({ connection_uri: z.string().url() })).min(1),
});

const listaProjetosSchema = z.object({
  projects: z.array(z.object({ id: z.string(), name: z.string(), pg_version: z.number().int() })),
});

function urlPooled(directUrl: string): string {
  const url = new URL(directUrl);
  const [endpoint, ...resto] = url.hostname.split(".");
  if (!endpoint || endpoint.endsWith("-pooler") || resto.length === 0) {
    throw new Error("Hostname Neon inesperado ao configurar pooling.");
  }
  url.hostname = `${endpoint}-pooler.${resto.join(".")}`;
  return url.toString();
}

export class ProjetoNeonEncontradoSemCredenciais extends Error {}

export class ClienteNeon {
  constructor(
    private readonly apiKey: string,
    private readonly orgId: string | undefined,
    private readonly regiao: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async criarOuReconciliar(evento: EventoParaProcessar): Promise<ProjetoProvisionado> {
    const nome = `tenant-${evento.tenantKey}`;
    const busca = new URL("https://console.neon.tech/api/v2/projects");
    busca.searchParams.set("search", nome);
    busca.searchParams.set("limit", "10");
    if (this.orgId) busca.searchParams.set("org_id", this.orgId);
    const encontrados = listaProjetosSchema.parse(await this.requisitar(busca, { method: "GET" }));
    const exatos = encontrados.projects.filter((projeto) => projeto.name === nome);
    if (exatos.length > 1) throw new Error("Mais de um projeto Neon encontrado para o tenant.");
    if (exatos.length === 1) {
      throw new ProjetoNeonEncontradoSemCredenciais(
        `Projeto Neon ${exatos[0].id} reconciliado, mas credenciais precisam ser recuperadas antes da retomada.`,
      );
    }

    const url = new URL("https://console.neon.tech/api/v2/projects");
    if (this.orgId) url.searchParams.set("org_id", this.orgId);
    const resposta = respostaCriacaoSchema.parse(await this.requisitar(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project: {
        name: nome, region_id: this.regiao, pg_version: 16,
        branch: { name: "production", role_name: "sysbelt_runtime", database_name: "sysbelt" },
      } }),
    }));
    const directUrl = resposta.connection_uris[0].connection_uri;
    return {
      providerProjectId: resposta.project.id,
      providerBranchId: resposta.branch.id,
      providerEndpointId: resposta.endpoints[0].id,
      databaseName: resposta.databases[0].name,
      roleName: resposta.roles[0].name,
      postgresVersion: resposta.project.pg_version,
      directUrl,
      pooledUrl: urlPooled(directUrl),
    };
  }

  private async requisitar(url: URL, init: RequestInit): Promise<unknown> {
    const resposta = await this.http(url, {
      ...init,
      headers: { authorization: `Bearer ${this.apiKey}`, accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resposta.ok) throw new Error(`Neon API respondeu com status ${resposta.status}.`);
    return resposta.json();
  }
}
