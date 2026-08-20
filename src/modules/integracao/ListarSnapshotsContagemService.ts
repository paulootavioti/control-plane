import { PrismaClient } from "@prisma/client";

export interface FiltrosSnapshotsContagem {
  assinanteId?: string;
  dataCorteInicio?: Date;
  dataCorteFim?: Date;
  pagina: number;
  limite: number;
}

export class ListarSnapshotsContagemService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosSnapshotsContagem) {
    const where = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...((filtros.dataCorteInicio || filtros.dataCorteFim) ? {
        dataCorte: {
          ...(filtros.dataCorteInicio ? { gte: filtros.dataCorteInicio } : {}),
          ...(filtros.dataCorteFim ? { lte: filtros.dataCorteFim } : {}),
        },
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.snapshotContagem.count({ where }),
      this.db.snapshotContagem.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ dataCorte: "desc" }, { id: "desc" }],
        select: {
          id: true,
          versaoContrato: true,
          dataCorte: true,
          recebidoEm: true,
          assinante: { select: { id: true, nomeFantasia: true, slug: true } },
          itens: {
            orderBy: [{ licenca: { nomeExibicao: "asc" } }, { id: "asc" }],
            select: {
              alunosAtivos: true,
              licenca: {
                select: {
                  id: true,
                  tenantUnidadeId: true,
                  nomeExibicao: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      itens: itens.map((snapshot) => ({
        ...snapshot,
        itens: snapshot.itens.map(({ licenca, alunosAtivos }) => ({
          licencaId: licenca.id,
          unidadeId: licenca.tenantUnidadeId,
          unidadeNome: licenca.nomeExibicao,
          statusLicenca: licenca.status,
          alunosAtivos,
        })),
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
