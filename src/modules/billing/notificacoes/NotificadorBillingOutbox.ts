import { Prisma, type PrismaClient } from "@prisma/client";
import type { DadosNotificacaoBilling, NotificadorBilling } from "./NotificadorBilling";

export class NotificadorBillingOutbox implements NotificadorBilling {
  constructor(private readonly db: PrismaClient) {}

  async enfileirar(dados: DadosNotificacaoBilling): Promise<{ criada: boolean }> {
    const chaveIdempotencia = `${dados.assinaturaId}:${dados.tipo}:d${dados.diaRegua}`;
    try {
      await this.db.notificacaoBilling.create({
        data: {
          assinaturaId: dados.assinaturaId,
          chaveIdempotencia,
          tipo: dados.tipo,
          destinatario: dados.destinatario,
          dados: { diaRegua: dados.diaRegua, produtoCodigo: dados.produtoCodigo },
        },
      });
      return { criada: true };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return { criada: false };
      throw erro;
    }
  }
}
