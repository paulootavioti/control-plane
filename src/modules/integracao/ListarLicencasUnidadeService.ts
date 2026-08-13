import { Prisma, PrismaClient, StatusLicencaUnidade } from "@prisma/client";

export interface FiltrosLicencasUnidade {
  assinanteId?: string;
  status?: StatusLicencaUnidade;
  busca?: string;
  sincronizadaInicio?: Date;
  sincronizadaFim?: Date;
  desatualizadaAntes?: Date;
  pagina: number;
  limite: number;
}

export class ListarLicencasUnidadeService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosLicencasUnidade) {
    const where: Prisma.LicencaUnidadeWhereInput = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...((filtros.busca || filtros.desatualizadaAntes) ? {
        AND: [
          ...(filtros.busca ? [{ OR: [
            { nomeExibicao: { contains: filtros.busca, mode: "insensitive" as const } },
            { tenantUnidadeId: { contains: filtros.busca, mode: "insensitive" as const } },
          ] }] : []),
          ...(filtros.desatualizadaAntes ? [{ OR: [
            { ultimaSincronizacaoEm: null },
            { ultimaSincronizacaoEm: { lt: filtros.desatualizadaAntes } },
          ] }] : []),
        ],
      } : {}),
      ...((filtros.sincronizadaInicio || filtros.sincronizadaFim) ? {
        ultimaSincronizacaoEm: {
          ...(filtros.sincronizadaInicio ? { gte: filtros.sincronizadaInicio } : {}),
          ...(filtros.sincronizadaFim ? { lte: filtros.sincronizadaFim } : {}),
        },
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.licencaUnidade.count({ where }),
      this.db.licencaUnidade.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ nomeExibicao: "asc" }, { id: "asc" }],
        select: {
          id: true,
          tenantUnidadeId: true,
          nomeExibicao: true,
          status: true,
          inicioCobrancaEm: true,
          encerramentoCobrancaEm: true,
          ultimaSincronizacaoEm: true,
          assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
        },
      }),
    ]);

    return {
      itens,
      paginacao: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }
}
