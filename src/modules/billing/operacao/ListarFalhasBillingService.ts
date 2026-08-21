import { PrismaClient } from "@prisma/client";

export class ListarFalhasBillingService {
  constructor(private readonly db: PrismaClient) {}

  async execute(limite = 20) {
    const [webhooks, notificacoes] = await Promise.all([
      this.db.eventoWebhookPagamento.findMany({
        where: { status: "FALHOU" },
        orderBy: { recebidoEm: "asc" },
        take: limite,
        select: {
          id: true, tipo: true, acao: true, tentativas: true,
          erroSanitizado: true, recebidoEm: true, processadoEm: true,
        },
      }),
      this.db.notificacaoBilling.findMany({
        where: { status: "FALHOU" },
        orderBy: { criadoEm: "asc" },
        take: limite,
        select: {
          id: true, tipo: true, tentativas: true, erroSanitizado: true,
          criadoEm: true, proximaTentativaEm: true,
        },
      }),
    ]);
    return { webhooks, notificacoes, limite };
  }
}
