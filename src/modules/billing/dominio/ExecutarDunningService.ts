import type { PrismaClient } from "@prisma/client";
import type { NotificadorBilling } from "../notificacoes/NotificadorBilling";
import type { ProvedorPagamento } from "../providers/ProvedorPagamento";
import { ReconciliarAssinaturaService } from "../reconciliacao/ReconciliarAssinaturaService";

export class ExecutarDunningService {
  constructor(
    private readonly db: PrismaClient,
    private readonly provedor: ProvedorPagamento,
    private readonly notificador: NotificadorBilling,
  ) {}

  async executarProxima(agora = new Date()): Promise<"VAZIO" | "PROCESSADO" | "CONCORRENTE"> {
    const leaseExpiradoEm = new Date(agora.getTime() - 15 * 60 * 1000);
    const tentativa = await this.db.tentativaDunning.findFirst({
      where: {
        agendadaPara: { lte: agora },
        OR: [
          { status: "PENDENTE" },
          { status: "EXECUTANDO", execucaoIniciadaEm: { lte: leaseExpiradoEm } },
        ],
      },
      orderBy: [{ agendadaPara: "asc" }, { criadoEm: "asc" }],
      select: {
        id: true, diaRegua: true, acao: true, status: true,
        assinatura: {
          select: {
            id: true, assinanteId: true, produtoCodigo: true,
            assinante: { select: { emailCobranca: true } },
          },
        },
      },
    });
    if (!tentativa) return "VAZIO";

    const claim = await this.db.tentativaDunning.updateMany({
      where: { id: tentativa.id, status: tentativa.status },
      data: { status: "EXECUTANDO", execucaoIniciadaEm: agora, erroSanitizado: null },
    });
    if (claim.count !== 1) return "CONCORRENTE";

    try {
      let reativada = false;
      if (tentativa.acao !== "NOTIFICAR") {
        const reconciliacao = await new ReconciliarAssinaturaService(this.db, this.provedor)
          .execute(tentativa.assinatura.id, agora);
        reativada = reconciliacao.status === "ATIVA";
      }

      if (reativada) {
        await this.notificador.enfileirar({
          assinaturaId: tentativa.assinatura.id,
          destinatario: tentativa.assinatura.assinante.emailCobranca,
          tipo: "ASSINATURA_REATIVADA",
          diaRegua: tentativa.diaRegua,
          produtoCodigo: tentativa.assinatura.produtoCodigo,
        });
      } else {
        if (tentativa.acao === "SUSPENDER_ADMINISTRATIVO") {
          await this.db.$transaction(async (tx) => {
            await tx.assinatura.update({
              where: { id: tentativa.assinatura.id }, data: { status: "SUSPENSA" },
            });
            await tx.tenantProduto.updateMany({
              where: {
                assinanteId: tentativa.assinatura.assinanteId,
                produtoCodigo: tentativa.assinatura.produtoCodigo,
                status: { not: "CANCELADO" },
              },
              data: { status: "SUSPENSO_FINANCEIRO" },
            });
          });
        }
        await this.notificador.enfileirar({
          assinaturaId: tentativa.assinatura.id,
          destinatario: tentativa.assinatura.assinante.emailCobranca,
          tipo: tentativa.acao === "SUSPENDER_ADMINISTRATIVO"
            ? "ASSINATURA_SUSPENSA"
            : tentativa.diaRegua === 0 ? "PAGAMENTO_FALHOU" : "RETENTATIVA_PENDENTE",
          diaRegua: tentativa.diaRegua,
          produtoCodigo: tentativa.assinatura.produtoCodigo,
        });
      }

      await this.db.tentativaDunning.update({
        where: { id: tentativa.id }, data: { status: "EXECUTADA", executadaEm: agora, execucaoIniciadaEm: null },
      });
      return "PROCESSADO";
    } catch (erro) {
      await this.db.tentativaDunning.update({
        where: { id: tentativa.id },
        data: {
          status: "PENDENTE",
          execucaoIniciadaEm: null,
          erroSanitizado: erro instanceof Error ? erro.message.slice(0, 300) : "ERRO_DESCONHECIDO",
        },
      });
      throw erro;
    }
  }
}
