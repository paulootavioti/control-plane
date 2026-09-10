import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class VincularTenantCompartilhadoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, tenantKey: string, schemaVersao: string, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const assinante = await tx.assinante.findUnique({
          where: { id: assinanteId },
          select: { id: true, slug: true, status: true, produtoCodigo: true, ambiente: { select: { id: true } } },
        });
        if (!assinante) throw new Error("ASSINANTE_NAO_ENCONTRADO");
        if (assinante.status !== "PROSPECT" || assinante.ambiente) throw new Error("ASSINANTE_NAO_ELEGIVEL");

        const secretRef = `compartilhado://${assinante.produtoCodigo}/${tenantKey}`;
        const agora = new Date();
        const ambiente = await tx.ambienteTenant.create({ data: {
          assinanteId,
          tenantKey,
          status: "PENDENTE",
          provider: "COMPARTILHADO",
          regiao: "COMPARTILHADA",
          secretRef,
          credentialVersion: 1,
          schemaVersaoAtual: schemaVersao,
          schemaVersaoDesejada: schemaVersao,
          ultimaMigrationEm: agora,
          ultimoHealthCheckEm: agora,
        } });
        await tx.tenantProduto.create({ data: {
          assinanteId,
          produtoCodigo: assinante.produtoCodigo,
          slug: assinante.slug,
          tenantKey,
          status: "PENDENTE",
          secretRef,
          schemaVersaoAtual: schemaVersao,
          credentialVersion: 1,
        } });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId,
          acao: "TENANT_COMPARTILHADO_VINCULADO",
          alvoTipo: "AMBIENTE_TENANT",
          alvoId: ambiente.id,
          mudancas: { produtoCodigo: assinante.produtoCodigo, schemaVersao, provider: "COMPARTILHADO" },
        } });
        return { id: ambiente.id, tenantKey, status: ambiente.status, provider: ambiente.provider, schemaVersaoAtual: schemaVersao };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("TENANT_KEY_JA_VINCULADO");
      }
      throw erro;
    }
  }
}
