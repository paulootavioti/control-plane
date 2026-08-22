import type { PrismaClient } from "@prisma/client";

export class ListarExecucoesWorkerBillingService {
  constructor(private readonly db: PrismaClient) {}

  async execute(limite = 20) {
    return this.db.execucaoWorkerBilling.findMany({
      orderBy: { iniciadoEm: "desc" },
      take: limite,
      select: {
        id: true, status: true, limite: true, eventos: true, dunning: true,
        reconciliacoes: true, notificacoes: true, falhas: true,
        erroSanitizado: true, iniciadoEm: true, concluidoEm: true,
      },
    });
  }
}
