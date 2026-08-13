import { PrismaClient } from "@prisma/client";

export class ObterAmbienteTenantService {
  constructor(private readonly db: PrismaClient) {}

  async execute(ambienteId: string) {
    const ambiente = await this.db.ambienteTenant.findUnique({
      where: { id: ambienteId },
      select: {
        id: true, status: true, provider: true, regiao: true, postgresVersion: true,
        credentialVersion: true, schemaVersaoAtual: true, schemaVersaoDesejada: true,
        ultimaMigrationEm: true, ultimoHealthCheckEm: true,
        ultimoBackupVerificadoEm: true, ultimaRotacaoEm: true,
        revisaoConcessao: true, ultimaConcessaoEmitidaEm: true,
        criadoEm: true, atualizadoEm: true,
        assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
        eventos: {
          take: 20,
          orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
          select: {
            id: true, tipo: true, status: true, etapaAtual: true, tentativas: true,
            erroSanitizado: true, iniciadoEm: true, concluidoEm: true,
            proximaTentativaEm: true, criadoEm: true, atualizadoEm: true,
          },
        },
      },
    });
    if (!ambiente) throw new Error("AMBIENTE_NAO_ENCONTRADO");

    const schemaDesatualizado = ambiente.schemaVersaoAtual !== ambiente.schemaVersaoDesejada;
    return {
      ...ambiente,
      schemaDesatualizado,
      necessitaAtencao: ambiente.status === "FALHOU" || schemaDesatualizado,
      eventos: ambiente.eventos.map((evento) => ({
        ...evento,
        retomadaManualDisponivel: evento.status === "FALHOU" && evento.tentativas >= 5,
      })),
    };
  }
}
