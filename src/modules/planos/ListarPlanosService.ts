import { PrismaClient } from "@prisma/client";

export class ListarPlanosService {
  constructor(private readonly db: PrismaClient) {}

  async execute(incluirHistorico: boolean, agora = new Date()) {
    return this.db.plano.findMany({
      where: incluirHistorico ? undefined : { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativo: true,
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
          },
        },
      },
    });
  }
}
