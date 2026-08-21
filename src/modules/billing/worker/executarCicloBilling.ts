import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../shared/prisma";
import { ExecutarDunningService } from "../dominio/ExecutarDunningService";
import { NotificadorBillingOutbox } from "../notificacoes/NotificadorBillingOutbox";
import { MercadoPagoHttp } from "../providers/MercadoPagoHttp";
import type { ProvedorPagamento } from "../providers/ProvedorPagamento";
import { ReconciliarAssinaturaService } from "../reconciliacao/ReconciliarAssinaturaService";
import { ProcessarEventoWebhookService } from "../webhooks/ProcessarEventoWebhookService";

export interface ResultadoCicloBilling {
  eventos: number;
  dunning: number;
  reconciliacoes: number;
  falhas: number;
}

function provedorConfigurado(): ProvedorPagamento {
  return new MercadoPagoHttp({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
    backUrl: process.env.MERCADO_PAGO_BACK_URL ?? "",
  });
}

export async function executarCicloBilling(
  db: PrismaClient = prisma,
  provedor: ProvedorPagamento = provedorConfigurado(),
  limite = 10,
): Promise<ResultadoCicloBilling> {
  const resultado = { eventos: 0, dunning: 0, reconciliacoes: 0, falhas: 0 };
  const processador = new ProcessarEventoWebhookService(db, provedor);
  for (let indice = 0; indice < limite; indice += 1) {
    try {
      const estado = await processador.executarProximo();
      if (estado === "VAZIO") break;
      if (estado === "PROCESSADO") resultado.eventos += 1;
    } catch { resultado.falhas += 1; }
  }

  const dunning = new ExecutarDunningService(db, provedor, new NotificadorBillingOutbox(db));
  for (let indice = 0; indice < limite; indice += 1) {
    try {
      const estado = await dunning.executarProxima();
      if (estado === "VAZIO") break;
      if (estado === "PROCESSADO") resultado.dunning += 1;
    } catch { resultado.falhas += 1; }
  }

  const assinaturas = await db.assinatura.findMany({
    where: {
      gateway: "MERCADO_PAGO",
      gatewayAssinaturaId: { not: null },
      status: { in: ["ATIVA", "INADIMPLENTE", "SUSPENSA"] },
    },
    orderBy: { atualizadoEm: "asc" },
    take: limite,
    select: { id: true },
  });
  for (const assinatura of assinaturas) {
    try {
      await new ReconciliarAssinaturaService(db, provedor).execute(assinatura.id);
      resultado.reconciliacoes += 1;
    } catch { resultado.falhas += 1; }
  }
  return resultado;
}
