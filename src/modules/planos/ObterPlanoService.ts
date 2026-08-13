import { PrismaClient } from "@prisma/client";

export class ObterPlanoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(planoId: string) {
    const [plano, correntesPorVersao] = await Promise.all([
      this.db.plano.findUnique({
        where: { id: planoId },
        select: {
          id: true,
          nome: true,
          descricao: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          versoes: {
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
              criadoEm: true,
              _count: { select: { assinaturas: true } },
            },
          },
        },
      }),
      this.db.assinatura.groupBy({
        by: ["planoVersaoId"],
        where: { planoVersao: { planoId }, encerradaEm: null },
        orderBy: { planoVersaoId: "asc" },
        _count: { planoVersaoId: true },
      }),
    ]);
    if (!plano) throw new Error("PLANO_NAO_ENCONTRADO");

    const correntes = new Map(correntesPorVersao.map((item) => [
      item.planoVersaoId,
      item._count.planoVersaoId,
    ]));
    return {
      ...plano,
      versoes: plano.versoes.map(({ _count, ...versao }) => ({
        ...versao,
        totalAssinaturas: _count.assinaturas,
        assinaturasCorrentes: correntes.get(versao.id) ?? 0,
      })),
    };
  }
}
