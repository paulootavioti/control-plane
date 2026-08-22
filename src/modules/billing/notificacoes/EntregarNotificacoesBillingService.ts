import type { PrismaClient } from "@prisma/client";
import type { TransportadorNotificacaoBilling } from "./TransportadorNotificacaoBilling";

const LEASE_MS = 15 * 60 * 1000;
const ATRASOS_MINUTOS = [5, 30, 120, 360];

function erroSanitizado(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "ERRO_DESCONHECIDO";
  return mensagem.replace(/https?:\/\/\S+/gi, "[url]").replace(/[\w.+-]+@[\w.-]+/gi, "[email]").slice(0, 300);
}

export class EntregarNotificacoesBillingService {
  constructor(private readonly db: PrismaClient, private readonly transportador: TransportadorNotificacaoBilling) {}

  async executarProxima(agora = new Date()): Promise<"VAZIO" | "ENVIADA" | "REAGENDADA" | "FALHOU"> {
    const leaseExpiradoEm = new Date(agora.getTime() - LEASE_MS);
    const candidata = await this.db.notificacaoBilling.findFirst({
      where: { OR: [
        { status: "PENDENTE", proximaTentativaEm: { lte: agora } },
        { status: "PROCESSANDO", processamentoIniciadoEm: { lte: leaseExpiradoEm } },
      ] },
      orderBy: { proximaTentativaEm: "asc" },
      select: { id: true, status: true },
    });
    if (!candidata) return "VAZIO";

    const adquirida = await this.db.notificacaoBilling.updateMany({
      where: {
        id: candidata.id,
        status: candidata.status,
        ...(candidata.status === "PROCESSANDO" ? { processamentoIniciadoEm: { lte: leaseExpiradoEm } } : { proximaTentativaEm: { lte: agora } }),
      },
      data: { status: "PROCESSANDO", processamentoIniciadoEm: agora, tentativas: { increment: 1 } },
    });
    if (adquirida.count === 0) return "VAZIO";

    const notificacao = await this.db.notificacaoBilling.findUniqueOrThrow({
      where: { id: candidata.id },
      select: { id: true, chaveIdempotencia: true, tipo: true, destinatario: true, dados: true, tentativas: true },
    });
    try {
      await this.transportador.enviar(notificacao);
      await this.db.notificacaoBilling.update({
        where: { id: notificacao.id },
        data: { status: "ENVIADA", enviadaEm: agora, processamentoIniciadoEm: null, erroSanitizado: null },
      });
      return "ENVIADA";
    } catch (erro) {
      const esgotada = notificacao.tentativas >= 5;
      const atraso = ATRASOS_MINUTOS[Math.min(notificacao.tentativas - 1, ATRASOS_MINUTOS.length - 1)];
      await this.db.notificacaoBilling.update({
        where: { id: notificacao.id },
        data: {
          status: esgotada ? "FALHOU" : "PENDENTE",
          processamentoIniciadoEm: null,
          proximaTentativaEm: esgotada ? agora : new Date(agora.getTime() + atraso * 60_000),
          erroSanitizado: erroSanitizado(erro),
        },
      });
      return esgotada ? "FALHOU" : "REAGENDADA";
    }
  }
}
