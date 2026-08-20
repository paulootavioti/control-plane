import { PrismaClient, StatusFatura } from "@prisma/client";

export interface FiltrosFaturas {
  assinanteId?: string;
  status?: StatusFatura;
  competencia?: string;
  vencimentoInicio?: Date;
  vencimentoFim?: Date;
  pagina: number;
  limite: number;
}

export class ListarFaturasService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosFaturas) {
    const where = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.competencia ? { competencia: filtros.competencia } : {}),
      ...((filtros.vencimentoInicio || filtros.vencimentoFim) ? {
        vencimentoEm: {
          ...(filtros.vencimentoInicio ? { gte: filtros.vencimentoInicio } : {}),
          ...(filtros.vencimentoFim ? { lte: filtros.vencimentoFim } : {}),
        },
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.fatura.count({ where }),
      this.db.fatura.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ vencimentoEm: "desc" }, { id: "desc" }],
        select: {
          id: true,
          competencia: true,
          vencimentoEm: true,
          status: true,
          totalCentavos: true,
          moeda: true,
          emitidaEm: true,
          pagaEm: true,
          criadoEm: true,
          assinante: { select: { id: true, nomeFantasia: true, slug: true } },
          assinatura: {
            select: {
              id: true,
              status: true,
              planoVersao: {
                select: { versao: true, plano: { select: { id: true, nome: true } } },
              },
            },
          },
          _count: { select: { itens: true } },
        },
      }),
    ]);

    return {
      itens: itens.map(({ _count, ...fatura }) => ({
        ...fatura,
        totalItens: _count.itens,
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
