import { PrismaClient } from "@prisma/client";

export class ListarPlanosService {
  constructor(private readonly db: PrismaClient) {}

  async execute(incluirHistorico: boolean, agora = new Date(), produto?: string) {
    return this.db.plano.findMany({
      where: incluirHistorico && !produto ? undefined : { ...(incluirHistorico ? {} : { ativo: true }), ...(produto ? { produtoCodigo: produto } : {}) },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativo: true,
        produto: { select: { codigo: true, nome: true } },
        versoes: {
          where: incluirHistorico ? undefined : {
            vigenteDesde: { lte: agora },
            OR: [{ vigenteAte: null }, { vigenteAte: { gt: agora } }],
          },
          orderBy: { versao: "desc" },
          select: {
            id: true,
            versao: true,
            vigenteDesde: true,
            vigenteAte: true,
            alunosPorBloco: true,
            precoPorBlocoCentavos: true,
            blocosMinimosPorUnidade: true,
            moeda: true,
            recursos: true,
            metadadosComerciais: true,
            _count: { select: { assinaturas: true } },
          },
        },
      },
    });
  }
}
