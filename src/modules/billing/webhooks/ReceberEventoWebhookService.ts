import { Prisma, type PrismaClient } from "@prisma/client";

export interface EventoRecebido {
  eventoExternoId: string;
  tipo: string;
  acao: string;
  payloadBruto: Prisma.InputJsonValue;
}

export class ReceberEventoWebhookService {
  constructor(private readonly db: PrismaClient) {}

  async execute(evento: EventoRecebido) {
    try {
      const registro = await this.db.eventoWebhookPagamento.create({
        data: { provedor: "MERCADO_PAGO", ...evento },
        select: { id: true, status: true },
      });
      return { ...registro, novo: true };
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2002") throw erro;
      const registro = await this.db.eventoWebhookPagamento.findUniqueOrThrow({
        where: {
          provedor_eventoExternoId: {
            provedor: "MERCADO_PAGO",
            eventoExternoId: evento.eventoExternoId,
          },
        },
        select: { id: true, status: true },
      });
      return { ...registro, novo: false };
    }
  }
}
