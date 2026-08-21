import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../../auditoria/contextoAuditoria";

export class ReprocessarWebhookBillingService {
  constructor(private readonly db: PrismaClient) {}

  async execute(eventoId: string, auditoria: ContextoAuditoria) {
    return this.db.$transaction(async (tx) => {
      const evento = await tx.eventoWebhookPagamento.findUnique({
        where: { id: eventoId }, select: { id: true, status: true, tentativas: true, tipo: true, acao: true },
      });
      if (!evento) throw new Error("EVENTO_WEBHOOK_NAO_ENCONTRADO");
      if (evento.status !== "FALHOU") throw new Error("EVENTO_WEBHOOK_NAO_ELEGIVEL");

      const adquirido = await tx.eventoWebhookPagamento.updateMany({
        where: { id: evento.id, status: "FALHOU" },
        data: {
          status: "RECEBIDO", tentativas: 0, erroSanitizado: null,
          processamentoIniciadoEm: null, processadoEm: null,
        },
      });
      if (adquirido.count === 0) return { eventoId: evento.id, duplicado: true };

      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        acao: "BILLING_WEBHOOK_REPROCESSADO",
        alvoTipo: "EVENTO_WEBHOOK_PAGAMENTO",
        alvoId: evento.id,
        mudancas: { tentativasAnteriores: evento.tentativas, tipo: evento.tipo, acao: evento.acao },
      } });
      return { eventoId: evento.id, duplicado: false };
    });
  }
}
