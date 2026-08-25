import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../shared/prisma";
import { ExecutarDunningService } from "../dominio/ExecutarDunningService";
import { NotificadorBillingOutbox } from "../notificacoes/NotificadorBillingOutbox";
import { EntregarNotificacoesBillingService } from "../notificacoes/EntregarNotificacoesBillingService";
import type { TransportadorNotificacaoBilling } from "../notificacoes/TransportadorNotificacaoBilling";
import { TransportadorNotificacaoWebhook } from "../notificacoes/TransportadorNotificacaoWebhook";
import { MercadoPagoHttp } from "../providers/MercadoPagoHttp";
import type { ProvedorPagamento } from "../providers/ProvedorPagamento";
import { ReconciliarAssinaturaService } from "../reconciliacao/ReconciliarAssinaturaService";
import { ProcessarEventoWebhookService } from "../webhooks/ProcessarEventoWebhookService";

export interface ResultadoCicloBilling {
  eventos: number;
  dunning: number;
  reconciliacoes: number;
  notificacoes: number;
  falhas: number;
}

function transporteConfigurado(): TransportadorNotificacaoBilling | undefined {
  if (process.env.BILLING_NOTIFICATION_DELIVERY_ENABLED !== "true") return undefined;
  return new TransportadorNotificacaoWebhook(
    process.env.BILLING_NOTIFICATION_WEBHOOK_URL ?? "",
    process.env.BILLING_NOTIFICATION_WEBHOOK_TOKEN ?? "",
  );
}

function provedorConfigurado(): ProvedorPagamento {
  return new MercadoPagoHttp({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
    backUrl: process.env.MERCADO_PAGO_BACK_URL ?? "",
    webhookUrl: process.env.MERCADO_PAGO_WEBHOOK_URL ?? "",
  });
}

export async function executarCicloBilling(
  db: PrismaClient = prisma,
  provedor: ProvedorPagamento = provedorConfigurado(),
  limite = 10,
  transportador: TransportadorNotificacaoBilling | undefined = transporteConfigurado(),
): Promise<ResultadoCicloBilling> {
  const resultado = { eventos: 0, dunning: 0, reconciliacoes: 0, notificacoes: 0, falhas: 0 };
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
  if (transportador) {
    const entregador = new EntregarNotificacoesBillingService(db, transportador);
    for (let indice = 0; indice < limite; indice += 1) {
      try {
        const estado = await entregador.executarProxima();
        if (estado === "VAZIO") break;
        if (estado === "ENVIADA") resultado.notificacoes += 1;
        if (estado === "FALHOU") resultado.falhas += 1;
      } catch { resultado.falhas += 1; }
    }
  }
  return resultado;
}
