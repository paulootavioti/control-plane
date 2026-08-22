import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../../auditoria/contextoAuditoria";

export class ReprocessarNotificacaoBillingService {
  constructor(private readonly db: PrismaClient) {}

  async execute(notificacaoId: string, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const notificacao = await tx.notificacaoBilling.findUnique({
        where: { id: notificacaoId },
        select: {
          id: true, status: true, tentativas: true, tipo: true,
          assinatura: { select: { assinanteId: true } },
        },
      });
      if (!notificacao) throw new Error("NOTIFICACAO_BILLING_NAO_ENCONTRADA");
      if (notificacao.status !== "FALHOU") throw new Error("NOTIFICACAO_BILLING_NAO_ELEGIVEL");

      const adquirido = await tx.notificacaoBilling.updateMany({
        where: { id: notificacao.id, status: "FALHOU" },
        data: {
          status: "PENDENTE", tentativas: 0, erroSanitizado: null,
          proximaTentativaEm: agora, enviadaEm: null, processamentoIniciadoEm: null,
        },
      });
      if (adquirido.count === 0) return { notificacaoId: notificacao.id, duplicado: true };

      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId: notificacao.assinatura.assinanteId,
        acao: "BILLING_NOTIFICACAO_REPROCESSADA",
        alvoTipo: "NOTIFICACAO_BILLING",
        alvoId: notificacao.id,
        mudancas: { tentativasAnteriores: notificacao.tentativas, tipo: notificacao.tipo },
      } });
      return { notificacaoId: notificacao.id, duplicado: false };
    });
  }
}
