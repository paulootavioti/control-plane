import { Prisma, PrismaClient, StatusFatura } from "@prisma/client";

export interface FiltrosResumoFinanceiro {
  assinanteId?: string;
  competencia?: string;
  vencimentoInicio?: Date;
  vencimentoFim?: Date;
}

interface TotalFinanceiro {
  quantidade: number;
  totalCentavos: number;
}

const zero = (): TotalFinanceiro => ({ quantidade: 0, totalCentavos: 0 });

function somar(...totais: TotalFinanceiro[]): TotalFinanceiro {
  return totais.reduce(
    (acumulado, atual) => ({
      quantidade: acumulado.quantidade + atual.quantidade,
      totalCentavos: acumulado.totalCentavos + atual.totalCentavos,
    }),
    zero(),
  );
}

export class ObterResumoFinanceiroService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosResumoFinanceiro) {
    const where: Prisma.FaturaWhereInput = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.competencia ? { competencia: filtros.competencia } : {}),
      ...(filtros.vencimentoInicio || filtros.vencimentoFim ? {
        vencimentoEm: {
          ...(filtros.vencimentoInicio ? { gte: filtros.vencimentoInicio } : {}),
          ...(filtros.vencimentoFim ? { lte: filtros.vencimentoFim } : {}),
        },
      } : {}),
    };

    const grupos = await this.db.fatura.groupBy({
      by: ["status"],
      where,
      orderBy: { status: "asc" },
      _count: { _all: true },
      _sum: { totalCentavos: true },
    });
    const grupoPorStatus = new Map(grupos.map((grupo) => [grupo.status, grupo]));
    const porStatus = Object.fromEntries(Object.values(StatusFatura).map((status) => {
      const grupo = grupoPorStatus.get(status);
      return [status, {
        quantidade: grupo?._count._all ?? 0,
        totalCentavos: grupo?._sum.totalCentavos ?? 0,
      }];
    })) as Record<StatusFatura, TotalFinanceiro>;

    return {
      filtros: {
        assinanteId: filtros.assinanteId ?? null,
        competencia: filtros.competencia ?? null,
        vencimentoInicio: filtros.vencimentoInicio ?? null,
        vencimentoFim: filtros.vencimentoFim ?? null,
      },
      porStatus,
      indicadores: {
        recebivel: somar(porStatus.ABERTA, porStatus.VENCIDA),
        recebido: porStatus.PAGA,
        estornado: porStatus.ESTORNADA,
        cancelado: porStatus.CANCELADA,
        rascunho: porStatus.RASCUNHO,
      },
    };
  }
}
