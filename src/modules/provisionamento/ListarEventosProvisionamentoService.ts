import {
  PrismaClient,
  StatusEventoProvisionamento,
  TipoEventoProvisionamento,
} from "@prisma/client";

export interface FiltrosEventosProvisionamento {
  assinanteId?: string;
  status?: StatusEventoProvisionamento;
  tipo?: TipoEventoProvisionamento;
  inicio?: Date;
  fim?: Date;
  pagina: number;
  limite: number;
}

export class ListarEventosProvisionamentoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosEventosProvisionamento) {
    const where = {
      ...(filtros.assinanteId ? { ambiente: { assinanteId: filtros.assinanteId } } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...((filtros.inicio || filtros.fim) ? {
        criadoEm: {
          ...(filtros.inicio ? { gte: filtros.inicio } : {}),
          ...(filtros.fim ? { lte: filtros.fim } : {}),
        },
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, eventos] = await this.db.$transaction([
      this.db.eventoProvisionamento.count({ where }),
      this.db.eventoProvisionamento.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        select: {
          id: true, tipo: true, status: true, etapaAtual: true, tentativas: true,
          erroSanitizado: true, iniciadoEm: true, concluidoEm: true,
          proximaTentativaEm: true, criadoEm: true, atualizadoEm: true,
          ambiente: { select: {
            id: true, status: true, provider: true, regiao: true,
            schemaVersaoAtual: true, schemaVersaoDesejada: true,
            assinante: { select: {
              id: true, nomeFantasia: true, slug: true, status: true,
            } },
          } },
        },
      }),
    ]);

    return {
      itens: eventos.map((evento) => ({
        ...evento,
        retomadaManualDisponivel: evento.status === "FALHOU" && evento.tentativas >= 5,
      })),
      paginacao: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }
}
