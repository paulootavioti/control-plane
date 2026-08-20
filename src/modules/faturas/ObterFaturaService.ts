import { PrismaClient } from "@prisma/client";

export class ObterFaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(faturaId: string) {
    const fatura = await this.db.fatura.findUnique({
      where: { id: faturaId },
      select: {
        id: true,
        assinanteId: true,
        assinaturaId: true,
        competencia: true,
        vencimentoEm: true,
        status: true,
        subtotalCentavos: true,
        descontoCentavos: true,
        acrescimoCentavos: true,
        totalCentavos: true,
        moeda: true,
        planoSnapshot: true,
        condicoesSnapshot: true,
        gateway: true,
        gatewayFaturaId: true,
        emitidaEm: true,
        pagaEm: true,
        canceladaEm: true,
        estornadaEm: true,
        criadoEm: true,
        atualizadoEm: true,
        assinante: { select: { nomeFantasia: true, slug: true } },
        itens: {
          orderBy: [{ nomeUnidade: "asc" }, { tenantUnidadeId: "asc" }],
          select: {
            id: true,
            tenantUnidadeId: true,
            nomeUnidade: true,
            alunosAtivos: true,
            alunosPorBloco: true,
            blocosCobrados: true,
            precoPorBlocoCentavos: true,
            valorCentavos: true,
          },
        },
      },
    });

    if (!fatura) throw new Error("FATURA_NAO_ENCONTRADA");
    return { ...fatura, totalItens: fatura.itens.length };
  }
}
