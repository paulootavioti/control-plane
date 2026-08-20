import { PrismaClient } from "@prisma/client";

export class ObterEventoProvisionamentoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(eventoId: string) {
    const evento = await this.db.eventoProvisionamento.findUnique({
      where: { id: eventoId },
      select: {
        id: true, tipo: true, status: true, etapaAtual: true, tentativas: true,
        erroSanitizado: true, iniciadoEm: true, concluidoEm: true,
        proximaTentativaEm: true, criadoEm: true, atualizadoEm: true,
        ambiente: { select: {
          id: true, tenantKey: true, status: true, provider: true, regiao: true,
          postgresVersion: true, schemaVersaoAtual: true, schemaVersaoDesejada: true,
          ultimaMigrationEm: true, ultimoHealthCheckEm: true,
          assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
        } },
      },
    });
    if (!evento) throw new Error("EVENTO_NAO_ENCONTRADO");
    return {
      ...evento,
      retomadaManualDisponivel: evento.status === "FALHOU" && evento.tentativas >= 5,
    };
  }
}
