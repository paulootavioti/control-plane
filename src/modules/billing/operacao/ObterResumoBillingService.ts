import { PrismaClient } from "@prisma/client";

export class ObterResumoBillingService {
  constructor(private readonly db: PrismaClient) {}

  async execute(agora = new Date()) {
    const [
      webhooksRecebidos, webhooksProcessando, webhooksFalhos, webhookMaisAntigo,
      dunningPendentes, dunningExecutando, dunningFalhos, dunningVencidoMaisAntigo,
      notificacoesPendentes, notificacoesFalhas, notificacaoMaisAntiga,
    ] = await Promise.all([
      this.db.eventoWebhookPagamento.count({ where: { status: "RECEBIDO" } }),
      this.db.eventoWebhookPagamento.count({ where: { status: "PROCESSANDO" } }),
      this.db.eventoWebhookPagamento.count({ where: { status: "FALHOU" } }),
      this.db.eventoWebhookPagamento.findFirst({
        where: { status: "RECEBIDO" }, orderBy: { recebidoEm: "asc" }, select: { recebidoEm: true },
      }),
      this.db.tentativaDunning.count({ where: { status: "PENDENTE" } }),
      this.db.tentativaDunning.count({ where: { status: "EXECUTANDO" } }),
      this.db.tentativaDunning.count({ where: { status: "FALHOU" } }),
      this.db.tentativaDunning.findFirst({
        where: { status: "PENDENTE", agendadaPara: { lte: agora } },
        orderBy: { agendadaPara: "asc" }, select: { agendadaPara: true },
      }),
      this.db.notificacaoBilling.count({ where: { status: "PENDENTE" } }),
      this.db.notificacaoBilling.count({ where: { status: "FALHOU" } }),
      this.db.notificacaoBilling.findFirst({
        where: { status: "PENDENTE", proximaTentativaEm: { lte: agora } },
        orderBy: { proximaTentativaEm: "asc" }, select: { proximaTentativaEm: true },
      }),
    ]);

    return {
      consultadoEm: agora,
      webhooks: {
        recebidos: webhooksRecebidos, processando: webhooksProcessando, falhos: webhooksFalhos,
        maisAntigoEm: webhookMaisAntigo?.recebidoEm ?? null,
      },
      dunning: {
        pendentes: dunningPendentes, executando: dunningExecutando, falhos: dunningFalhos,
        vencidoMaisAntigoEm: dunningVencidoMaisAntigo?.agendadaPara ?? null,
      },
      notificacoes: {
        pendentes: notificacoesPendentes, falhas: notificacoesFalhas,
        prontaMaisAntigaEm: notificacaoMaisAntiga?.proximaTentativaEm ?? null,
      },
    };
  }
}
