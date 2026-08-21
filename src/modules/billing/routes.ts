import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { IniciarCobrancaRecorrenteService } from "./IniciarCobrancaRecorrenteService";
import { ObterResumoBillingService } from "./operacao/ObterResumoBillingService";
import { ReprocessarNotificacaoBillingService } from "./operacao/ReprocessarNotificacaoBillingService";
import { ReprocessarWebhookBillingService } from "./operacao/ReprocessarWebhookBillingService";
import { MercadoPagoHttp } from "./providers/MercadoPagoHttp";
import { ReconciliarAssinaturaService } from "./reconciliacao/ReconciliarAssinaturaService";
import { ReceberEventoWebhookService } from "./webhooks/ReceberEventoWebhookService";
import { chaveEventoMercadoPago, verificarAssinaturaMercadoPago } from "./webhooks/verificarAssinaturaMercadoPago";

export const billingRoutes = Router();

billingRoutes.get(
  "/operacao/resumo",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (_request, response) => response.json(await new ObterResumoBillingService(prisma).execute()),
);

billingRoutes.post(
  "/operacao/webhooks/:eventoId/reprocessar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const eventoId = z.string().uuid().safeParse(request.params.eventoId);
    if (!eventoId.success) return response.status(400).json({ codigo: "EVENTO_WEBHOOK_INVALIDO" });
    try {
      return response.json(await new ReprocessarWebhookBillingService(prisma)
        .execute(eventoId.data, contextoAuditoria(request, response)));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "EVENTO_WEBHOOK_NAO_ENCONTRADO") {
        return response.status(404).json({ codigo: erro.message });
      }
      if (erro instanceof Error && erro.message === "EVENTO_WEBHOOK_NAO_ELEGIVEL") {
        return response.status(409).json({ codigo: erro.message });
      }
      throw erro;
    }
  },
);

billingRoutes.post(
  "/operacao/notificacoes/:notificacaoId/reprocessar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const notificacaoId = z.string().uuid().safeParse(request.params.notificacaoId);
    if (!notificacaoId.success) return response.status(400).json({ codigo: "NOTIFICACAO_BILLING_INVALIDA" });
    try {
      return response.json(await new ReprocessarNotificacaoBillingService(prisma)
        .execute(notificacaoId.data, contextoAuditoria(request, response)));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "NOTIFICACAO_BILLING_NAO_ENCONTRADA") {
        return response.status(404).json({ codigo: erro.message });
      }
      if (erro instanceof Error && erro.message === "NOTIFICACAO_BILLING_NAO_ELEGIVEL") {
        return response.status(409).json({ codigo: erro.message });
      }
      throw erro;
    }
  },
);

const jsonPrisma = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;

function mercadoPagoConfigurado() {
  return new MercadoPagoHttp({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
    backUrl: process.env.MERCADO_PAGO_BACK_URL ?? "",
  });
}

const iniciarSchema = z.object({
  valorCentavos: z.number().int().positive(),
  meioPagamento: z.enum(["CARTAO", "PIX"]),
  inicioEm: z.coerce.date(),
}).strict();

billingRoutes.post(
  "/assinaturas/:assinaturaId/iniciar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const assinaturaId = z.string().uuid().safeParse(request.params.assinaturaId);
    const dados = iniciarSchema.safeParse(request.body);
    if (!assinaturaId.success || !dados.success) return response.status(400).json({ codigo: "COBRANCA_INVALIDA" });
    try {
      const resultado = await new IniciarCobrancaRecorrenteService(prisma, mercadoPagoConfigurado())
        .execute(assinaturaId.data, dados.data);
      return response.status(resultado.existente ? 200 : 201).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_ELEGIVEL") {
        return response.status(409).json({ codigo: erro.message });
      }
      throw erro;
    }
  },
);

billingRoutes.post(
  "/assinaturas/:assinaturaId/reconciliar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const assinaturaId = z.string().uuid().safeParse(request.params.assinaturaId);
    if (!assinaturaId.success) return response.status(400).json({ codigo: "ASSINATURA_INVALIDA" });
    try {
      return response.json(await new ReconciliarAssinaturaService(prisma, mercadoPagoConfigurado())
        .execute(assinaturaId.data));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINATURA_SEM_VINCULO_PSP") {
        return response.status(409).json({ codigo: erro.message });
      }
      throw erro;
    }
  },
);

const eventoSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().min(1).max(80),
  action: z.string().min(1).max(100),
  data: z.object({ id: z.union([z.string(), z.number()]) }).passthrough(),
}).passthrough();

billingRoutes.post("/webhooks/mercado-pago", async (request, response) => {
  const evento = eventoSchema.safeParse(request.body);
  if (!evento.success) return response.status(400).json({ codigo: "EVENTO_INVALIDO" });
  const dataId = String(request.query["data.id"] ?? evento.data.data.id);
  if (dataId !== String(evento.data.data.id)) return response.status(400).json({ codigo: "IDENTIFICADOR_DIVERGENTE" });
  try {
    verificarAssinaturaMercadoPago({
      assinatura: request.header("x-signature") ?? "",
      requestId: request.header("x-request-id") ?? "",
      dataId,
    }, process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "");
  } catch {
    return response.status(401).json({ codigo: "ASSINATURA_WEBHOOK_INVALIDA" });
  }
  const eventoExternoId = chaveEventoMercadoPago(evento.data.type, evento.data.action, dataId);
  const registro = await new ReceberEventoWebhookService(prisma).execute({
    eventoExternoId,
    tipo: evento.data.type,
    acao: evento.data.action,
    payloadBruto: jsonPrisma(evento.data),
  });
  return response.status(registro.novo ? 202 : 200).json({ recebido: true, duplicado: !registro.novo });
});

function segredoIgual(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Permite testes de contrato sem acessar o Mercado Pago. Deve ficar desabilitado
// por padrão e exige o segredo interno mesmo em ambientes não produtivos.
billingRoutes.post("/test/eventos", async (request, response) => {
  const segredo = process.env.CONTROL_PLANE_WORKER_SECRET ?? "";
  const recebido = request.header("x-control-plane-worker-secret") ?? "";
  if (process.env.BILLING_TEST_EVENTS_ENABLED !== "true" || segredo.length < 32 || !segredoIgual(recebido, segredo)) {
    return response.status(404).json({ codigo: "ROTA_NAO_ENCONTRADA" });
  }
  const evento = eventoSchema.safeParse(request.body);
  if (!evento.success) return response.status(400).json({ codigo: "EVENTO_INVALIDO" });
  const dataId = String(evento.data.data.id);
  const registro = await new ReceberEventoWebhookService(prisma).execute({
    eventoExternoId: `teste:${chaveEventoMercadoPago(evento.data.type, evento.data.action, dataId)}`,
    tipo: evento.data.type,
    acao: evento.data.action,
    payloadBruto: jsonPrisma(evento.data),
  });
  return response.status(registro.novo ? 202 : 200).json({ recebido: true, duplicado: !registro.novo, simulado: true });
});
