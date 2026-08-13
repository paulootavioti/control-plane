import { PrismaClient } from "@prisma/client";

export class ObterAssinaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinaturaId: string) {
    const assinatura = await this.db.assinatura.findUnique({
      where: { id: assinaturaId },
      select: {
        id: true, status: true, inicioEm: true, testeAte: true, canceladaEm: true,
        encerradaEm: true, diaVencimento: true, alunosPorBlocoNegociado: true,
        precoPorBlocoCentavosNegociado: true, blocosMinimosPorUnidadeNegociado: true,
        criadoEm: true, atualizadoEm: true,
        assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
        planoVersao: { select: {
          id: true, versao: true, vigenteDesde: true, vigenteAte: true,
          alunosPorBloco: true, precoPorBlocoCentavos: true,
          blocosMinimosPorUnidade: true, moeda: true, recursos: true,
          plano: { select: { id: true, nome: true, ativo: true } },
        } },
        faturas: {
          take: 12,
          orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
          select: {
            id: true, competencia: true, vencimentoEm: true, status: true,
            subtotalCentavos: true, descontoCentavos: true, acrescimoCentavos: true,
            totalCentavos: true, moeda: true, emitidaEm: true, pagaEm: true,
            canceladaEm: true, estornadaEm: true,
          },
        },
        _count: { select: { faturas: true } },
      },
    });
    if (!assinatura) throw new Error("ASSINATURA_NAO_ENCONTRADA");
    const { _count, ...detalhe } = assinatura;
    return { ...detalhe, totalFaturas: _count.faturas };
  }
}
