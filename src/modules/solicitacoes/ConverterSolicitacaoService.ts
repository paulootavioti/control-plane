import { Prisma, PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

const slug = (nome: string, id: string) => `${nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 52) || "organizacao"}-${id.slice(0, 8)}`;

export class ConverterSolicitacaoService {
  constructor(private readonly db: PrismaClient) {}
  async execute(id: string, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`);
        const s = await tx.solicitacaoAssinatura.findUnique({ where: { id } });
        if (!s) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
        if (s.status === "CONVERTIDA" && s.assinanteId) return { assinanteId: s.assinanteId, idempotente: true };
        if (s.status !== "APROVADA") throw new Error("SOLICITACAO_NAO_APROVADA");
        const assinante = await tx.assinante.create({ data: { produtoCodigo: s.produtoId,
          nomeFantasia: s.nomeOrganizacao, documento: s.documento, emailCobranca: s.email,
          telefone: s.telefone, slug: slug(s.nomeOrganizacao, s.id), status: "PROSPECT",
          contatos: { create: { nome: s.responsavel, email: s.email, telefone: s.telefone,
            tipo: "PROPRIETARIO", principal: true } } }, select: { id: true } });
        await tx.solicitacaoAssinatura.update({ where: { id }, data: { status: "CONVERTIDA", assinanteId: assinante.id } });
        await tx.auditLogPlataforma.create({ data: { ...auditoria, assinanteId: assinante.id,
          acao: "SOLICITACAO_CONVERTIDA", alvoTipo: "SOLICITACAO_ASSINATURA", alvoId: id,
          mudancas: { produtoId: s.produtoId, assinanteId: assinante.id, contatoPrincipalCriado: true,
            documentoPresente: true, emailPresente: true, telefonePresente: Boolean(s.telefone) } } });
        return { assinanteId: assinante.id, idempotente: false };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new Error("ASSINANTE_DUPLICADO");
      throw erro;
    }
  }
}
