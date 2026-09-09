import { Prisma, PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class DecidirSolicitacaoService {
  constructor(private readonly db: PrismaClient) {}
  async execute(id: string, decisao: "APROVADA" | "RECUSADA", motivo: string | undefined, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`);
      const atual = await tx.solicitacaoAssinatura.findUnique({ where: { id }, select: { id: true, status: true, motivo: true } });
      if (!atual) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
      if (atual.status === decisao) return { ...atual, idempotente: true };
      if (atual.status !== "RECEBIDA") throw new Error("SOLICITACAO_JA_DECIDIDA");
      const item = await tx.solicitacaoAssinatura.update({ where: { id }, data: { status: decisao,
        motivo: decisao === "RECUSADA" ? motivo : null, decididoEm: agora, decididoPor: auditoria.operadorId },
        select: { id: true, status: true, motivo: true, decididoEm: true } });
      await tx.auditLogPlataforma.create({ data: { ...auditoria, acao: `SOLICITACAO_${decisao}`,
        alvoTipo: "SOLICITACAO_ASSINATURA", alvoId: id, mudancas: { de: "RECEBIDA", para: decisao,
          motivoPresente: Boolean(motivo) } } });
      return { ...item, idempotente: false };
    });
  }
}
