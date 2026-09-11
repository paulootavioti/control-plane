import { PrismaClient } from "@prisma/client";

import { GerarConcessaoService } from "./GerarConcessaoService";

type GeradorConcessao = Pick<GerarConcessaoService, "execute">;
type Fetch = typeof fetch;

function dominioTenant(): string {
  const dominio = process.env.TENANT_APP_BASE_DOMAIN?.trim().toLowerCase();
  if (!dominio || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dominio)) {
    throw new Error("TENANT_APP_BASE_DOMAIN não configurado corretamente.");
  }
  return dominio;
}

function validarSlug(slug: string): string {
  const normalizado = slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalizado)) {
    throw new Error("SLUG_ASSINANTE_INVALIDO");
  }
  return normalizado;
}

function destinoTenant(produto: string, slug: string): string {
  const bruto = process.env.TENANT_PRODUCT_HOST_MAP?.trim();
  if (bruto) {
    let mapa: Record<string, string>;
    try { mapa = JSON.parse(bruto) as Record<string, string>; }
    catch { throw new Error("TENANT_PRODUCT_HOST_MAP inválido."); }
    const configurado = mapa[`${produto}:${slug}`];
    if (configurado) {
      const url = new URL(configurado);
      if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("TENANT_PRODUCT_HOST_MAP inválido.");
      }
      return url.origin;
    }
  }
  return `https://${slug}.${dominioTenant()}`;
}

export class EnviarConcessaoService {
  private readonly gerador: GeradorConcessao;

  constructor(
    private readonly db: PrismaClient,
    private readonly requisicao: Fetch = fetch,
    gerador?: GeradorConcessao,
  ) {
    this.gerador = gerador ?? new GerarConcessaoService(db);
  }

  async execute(ambienteId: string) {
    const ambiente = await this.db.ambienteTenant.findUnique({
      where: { id: ambienteId },
      select: { status: true, assinante: { select: { slug: true, produtoCodigo: true } } },
    });
    if (!ambiente) throw new Error("AMBIENTE_NAO_ENCONTRADO");
    if (ambiente.status !== "ATIVO") throw new Error("AMBIENTE_NAO_ELEGIVEL");

    const slug = validarSlug(ambiente.assinante.slug);
    const concessao = await this.gerador.execute(ambienteId);
    const url = `${destinoTenant(ambiente.assinante.produtoCodigo, slug)}/api/integracao/control-plane/v1/concessao`;

    let resposta: Response;
    try {
      resposta = await this.requisicao(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(concessao),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("ENTREGA_CONCESSAO_INCERTA");
    }

    if (!resposta.ok) throw new Error(`ENTREGA_CONCESSAO_RECUSADA:${resposta.status}`);
    let resultado: { revisao?: unknown; duplicada?: unknown };
    try {
      resultado = await resposta.json() as { revisao?: unknown; duplicada?: unknown };
    } catch {
      throw new Error("RESPOSTA_TENANT_INVALIDA");
    }
    if (resultado.revisao !== concessao.revisao || typeof resultado.duplicada !== "boolean") {
      throw new Error("RESPOSTA_TENANT_INVALIDA");
    }
    return { revisao: concessao.revisao, expiraEm: concessao.expiraEm, duplicada: resultado.duplicada, destino: url };
  }
}
