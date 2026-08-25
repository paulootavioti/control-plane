import { PrismaClient } from "@prisma/client";

export class ObterEvidenciaWebhookMercadoPagoService {
  constructor(private readonly db: PrismaClient) {}

  async execute() {
    const evento = await this.db.eventoWebhookPagamento.findFirst({
      where: {
        provedor: "MERCADO_PAGO",
        eventoExternoId: { not: { startsWith: "teste:" } },
      },
      orderBy: { recebidoEm: "desc" },
      select: {
        tipo: true,
        acao: true,
        status: true,
        recebidoEm: true,
        processadoEm: true,
      },
    });

    return {
      homologado: Boolean(evento),
      assinaturaValidada: Boolean(evento),
      ultimoEvento: evento ?? null,
    };
  }
}
