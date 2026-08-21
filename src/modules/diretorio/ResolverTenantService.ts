import type { PrismaClient } from "@prisma/client";

export class ResolverTenantService {
  constructor(private readonly db: PrismaClient) {}

  async execute(produtoCodigo: string, slug: string) {
    const ambiente = await this.db.tenantProduto.findFirst({
      where: { produtoCodigo, slug, status: { in: ["ATIVO", "SUSPENSO_FINANCEIRO", "SUSPENSO_OPERACIONAL"] } },
      select: {
        tenantKey: true,
        status: true,
        secretRef: true,
        schemaVersaoAtual: true,
        credentialVersion: true,
        produto: { select: { codigo: true, politicaAcessoInadimplencia: true } },
      },
    });
    if (!ambiente?.secretRef || !ambiente.schemaVersaoAtual) {
      throw new Error("TENANT_NAO_ENCONTRADO");
    }
    return {
      schemaVersion: "1.0",
      tenantKey: ambiente.tenantKey,
      produto: ambiente.produto.codigo,
      slug,
      status: ambiente.status,
      acesso: {
        administrativo: ambiente.status === "ATIVO" ? "LIBERADO" : "RESTRITO_REGULARIZACAO",
        clinico: ambiente.produto.politicaAcessoInadimplencia === "SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO"
          ? "LIBERADO" : "NAO_APLICAVEL",
      },
      secretRef: ambiente.secretRef,
      tenantSchemaVersion: ambiente.schemaVersaoAtual,
      credentialVersion: ambiente.credentialVersion,
    };
  }
}
