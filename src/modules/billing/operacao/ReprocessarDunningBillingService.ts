import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../../auditoria/contextoAuditoria";

export class ReprocessarDunningBillingService {
  constructor(private readonly db: PrismaClient) {}

  async execute(tentativaId: string, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const tentativa = await tx.tentativaDunning.findUnique({
        where: { id: tentativaId },
        select: {
          id: true, status: true, diaRegua: true, acao: true,
          assinatura: { select: { id: true, assinanteId: true, status: true } },
        },
      });
      if (!tentativa) throw new Error("TENTATIVA_DUNNING_NAO_ENCONTRADA");
      if (tentativa.status !== "FALHOU") throw new Error("TENTATIVA_DUNNING_NAO_ELEGIVEL");
      if (["CANCELADA", "ENCERRADA"].includes(tentativa.assinatura.status)) {
        throw new Error("ASSINATURA_NAO_ELEGIVEL");
      }

      const adquirido = await tx.tentativaDunning.updateMany({
        where: { id: tentativa.id, status: "FALHOU" },
        data: {
          status: "PENDENTE", agendadaPara: agora, executadaEm: null,
          execucaoIniciadaEm: null, erroSanitizado: null,
        },
      });
      if (adquirido.count === 0) return { tentativaId: tentativa.id, duplicado: true };

      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId: tentativa.assinatura.assinanteId,
        acao: "BILLING_DUNNING_REPROCESSADO",
        alvoTipo: "TENTATIVA_DUNNING",
        alvoId: tentativa.id,
        mudancas: {
          assinaturaId: tentativa.assinatura.id,
          diaRegua: tentativa.diaRegua,
          acao: tentativa.acao,
        },
      } });
      return { tentativaId: tentativa.id, duplicado: false };
    });
  }
}
