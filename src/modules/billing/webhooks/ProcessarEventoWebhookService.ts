import { Prisma, type PrismaClient } from "@prisma/client";
import { AgendarDunningService } from "../dominio/AgendarDunningService";
import type { ProvedorPagamento } from "../providers/ProvedorPagamento";
import { ReconciliarAssinaturaService } from "../reconciliacao/ReconciliarAssinaturaService";

function idDoPayload(payload: Prisma.JsonValue): string {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new Error("PAYLOAD_WEBHOOK_INVALIDO");
  const data = payload.data;
  if (!data || Array.isArray(data) || typeof data !== "object" || !("id" in data)) throw new Error("PAYLOAD_WEBHOOK_INVALIDO");
  const id = data.id;
  if (typeof id !== "string" && typeof id !== "number") throw new Error("PAYLOAD_WEBHOOK_INVALIDO");
  return String(id);
}

export class ProcessarEventoWebhookService {
  constructor(private readonly db: PrismaClient, private readonly provedor: ProvedorPagamento) {}

  async executarProximo(agora = new Date()): Promise<"VAZIO" | "PROCESSADO" | "CONCORRENTE"> {
    const leaseExpiradoEm = new Date(agora.getTime() - 15 * 60 * 1000);
    const evento = await this.db.eventoWebhookPagamento.findFirst({
      where: {
        tentativas: { lt: 5 },
        OR: [
          { status: { in: ["RECEBIDO", "FALHOU"] } },
          { status: "PROCESSANDO", processamentoIniciadoEm: { lte: leaseExpiradoEm } },
        ],
      },
      orderBy: { recebidoEm: "asc" },
      select: { id: true, tipo: true, status: true, payloadBruto: true },
    });
    if (!evento) return "VAZIO";
    const claim = await this.db.eventoWebhookPagamento.updateMany({
      where: { id: evento.id, status: evento.status },
      data: { status: "PROCESSANDO", processamentoIniciadoEm: agora, tentativas: { increment: 1 }, erroSanitizado: null },
    });
    if (claim.count !== 1) return "CONCORRENTE";

    try {
      if (evento.tipo === "subscription_preapproval") {
        const gatewayAssinaturaId = idDoPayload(evento.payloadBruto);
        const assinatura = await this.db.assinatura.findUnique({
          where: { gatewayAssinaturaId }, select: { id: true },
        });
        if (!assinatura) throw new Error("ASSINATURA_EVENTO_NAO_ENCONTRADA");
        const resultado = await new ReconciliarAssinaturaService(this.db, this.provedor).execute(assinatura.id, agora);
        if (resultado.alterada && resultado.status === "INADIMPLENTE") {
          await new AgendarDunningService(this.db).execute(assinatura.id, agora);
        }
      }
      await this.db.eventoWebhookPagamento.update({
        where: { id: evento.id }, data: { status: "PROCESSADO", processadoEm: agora, processamentoIniciadoEm: null },
      });
      return "PROCESSADO";
    } catch (erro) {
      await this.db.eventoWebhookPagamento.update({
        where: { id: evento.id },
        data: {
          status: "FALHOU",
          processamentoIniciadoEm: null,
          erroSanitizado: erro instanceof Error ? erro.message.slice(0, 300) : "ERRO_DESCONHECIDO",
        },
      });
      throw erro;
    }
  }
}
