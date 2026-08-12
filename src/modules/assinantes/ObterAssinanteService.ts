import { PrismaClient } from "@prisma/client";

export class ObterAssinanteService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string) {
    const assinante = await this.db.assinante.findUnique({
      where: { id: assinanteId },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        documento: true,
        emailCobranca: true,
        telefone: true,
        slug: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
        contatos: {
          orderBy: [{ principal: "desc" }, { nome: "asc" }],
          select: {
            id: true, nome: true, email: true, telefone: true, tipo: true, principal: true,
          },
        },
        licencas: {
          orderBy: [{ status: "asc" }, { nomeExibicao: "asc" }],
          select: {
            id: true, tenantUnidadeId: true, nomeExibicao: true, status: true,
            inicioCobrancaEm: true, encerramentoCobrancaEm: true, ultimaSincronizacaoEm: true,
          },
        },
        ambiente: {
          select: {
            id: true, tenantKey: true, status: true, provider: true, regiao: true,
            postgresVersion: true, schemaVersaoAtual: true, schemaVersaoDesejada: true,
            ultimaMigrationEm: true, ultimoHealthCheckEm: true,
            ultimoBackupVerificadoEm: true, ultimaRotacaoEm: true,
            revisaoConcessao: true, ultimaConcessaoEmitidaEm: true,
          },
        },
        assinaturas: {
          where: { encerradaEm: null },
          take: 1,
          orderBy: { criadoEm: "desc" },
          select: {
            id: true, status: true, inicioEm: true, testeAte: true, canceladaEm: true,
            diaVencimento: true, alunosPorBlocoNegociado: true,
            precoPorBlocoCentavosNegociado: true, blocosMinimosPorUnidadeNegociado: true,
            planoVersao: {
              select: {
                id: true, versao: true, alunosPorBloco: true, precoPorBlocoCentavos: true,
                blocosMinimosPorUnidade: true, moeda: true, recursos: true,
                plano: { select: { id: true, nome: true, descricao: true } },
              },
            },
          },
        },
        faturas: {
          take: 12,
          orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
          select: {
            id: true, competencia: true, vencimentoEm: true, status: true,
            subtotalCentavos: true, descontoCentavos: true, acrescimoCentavos: true,
            totalCentavos: true, moeda: true, gateway: true, emitidaEm: true, pagaEm: true,
            _count: { select: { itens: true } },
          },
        },
      },
    });

    if (!assinante) throw new Error("ASSINANTE_NAO_ENCONTRADO");
    const { assinaturas, faturas, ...dados } = assinante;
    return {
      ...dados,
      assinatura: assinaturas[0] ?? null,
      faturas: faturas.map(({ _count, ...fatura }) => ({
        ...fatura,
        totalItens: _count.itens,
      })),
    };
  }
}
