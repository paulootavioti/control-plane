import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

function intervaloCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1)),
    fim: new Date(Date.UTC(ano, mes, 1)),
  };
}

export function vencimentoDaCompetencia(competencia: string, dia: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export class GerarFaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, competencia: string, auditoria: ContextoAuditoria) {
    const corrente = await this.obterExistente(assinanteId, competencia);
    if (corrente) return { ...corrente, duplicado: true };

    try {
      return await this.db.$transaction(async (tx) => {
        const assinatura = await tx.assinatura.findFirst({
          where: {
            assinanteId,
            encerradaEm: null,
            status: { in: ["ATIVA", "INADIMPLENTE"] },
          },
          select: {
            id: true, diaVencimento: true, politicaCobranca: true,
            alunosPorBlocoNegociado: true, precoPorBlocoCentavosNegociado: true,
            blocosMinimosPorUnidadeNegociado: true,
            planoVersao: { select: {
              id: true, versao: true, alunosPorBloco: true,
              precoPorBlocoCentavos: true, blocosMinimosPorUnidade: true,
              moeda: true, plano: { select: { id: true, nome: true } },
            } },
          },
        });
        if (!assinatura) throw new Error("ASSINATURA_NAO_FATURAVEL");

        const { inicio, fim } = intervaloCompetencia(competencia);
        const snapshot = await tx.snapshotContagem.findFirst({
          where: { assinanteId, dataCorte: { gte: inicio, lt: fim } },
          orderBy: { dataCorte: "desc" },
          select: {
            id: true, dataCorte: true,
            itens: { select: {
              alunosAtivos: true,
              licenca: { select: { tenantUnidadeId: true, nomeExibicao: true, status: true } },
            } },
          },
        });
        if (!snapshot) throw new Error("SNAPSHOT_NAO_ENCONTRADO");

        const alunosPorBloco = assinatura.alunosPorBlocoNegociado ?? assinatura.planoVersao.alunosPorBloco;
        const precoPorBlocoCentavos = assinatura.precoPorBlocoCentavosNegociado ?? assinatura.planoVersao.precoPorBlocoCentavos;
        const blocosMinimos = assinatura.blocosMinimosPorUnidadeNegociado ?? assinatura.planoVersao.blocosMinimosPorUnidade;
        const itens = snapshot.itens
          .filter(({ licenca }) => licenca.status === "ATIVA")
          .map(({ alunosAtivos, licenca }) => {
            const blocosCobrados = Math.max(blocosMinimos, Math.ceil(alunosAtivos / alunosPorBloco));
            return {
              tenantUnidadeId: licenca.tenantUnidadeId,
              nomeUnidade: licenca.nomeExibicao,
              alunosAtivos,
              alunosPorBloco,
              blocosCobrados,
              precoPorBlocoCentavos,
              valorCentavos: blocosCobrados * precoPorBlocoCentavos,
            };
          });
        if (itens.length === 0) throw new Error("SEM_UNIDADES_FATURAVEIS");

        const subtotalCentavos = itens.reduce((total, item) => total + item.valorCentavos, 0);
        const fatura = await tx.fatura.create({
          data: {
            assinanteId,
            assinaturaId: assinatura.id,
            competencia,
            vencimentoEm: vencimentoDaCompetencia(competencia, assinatura.diaVencimento),
            subtotalCentavos,
            totalCentavos: subtotalCentavos,
            moeda: assinatura.planoVersao.moeda,
            planoSnapshot: {
              planoId: assinatura.planoVersao.plano.id,
              planoNome: assinatura.planoVersao.plano.nome,
              planoVersaoId: assinatura.planoVersao.id,
              versao: assinatura.planoVersao.versao,
            },
            condicoesSnapshot: {
              snapshotContagemId: snapshot.id,
              dataCorte: snapshot.dataCorte,
              alunosPorBloco,
              precoPorBlocoCentavos,
              blocosMinimosPorUnidade: blocosMinimos,
              politicaCobranca: assinatura.politicaCobranca,
            },
            itens: { create: itens },
          },
          select: {
            id: true, assinanteId: true, assinaturaId: true, competencia: true,
            vencimentoEm: true, status: true, subtotalCentavos: true,
            totalCentavos: true, moeda: true,
          },
        });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId,
          acao: "FATURA_RASCUNHO_GERADA",
          alvoTipo: "FATURA",
          alvoId: fatura.id,
          mudancas: { competencia, totalCentavos: fatura.totalCentavos, totalItens: itens.length },
        } });
        return { ...fatura, duplicado: false };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        const concorrente = await this.obterExistente(assinanteId, competencia);
        if (concorrente) return { ...concorrente, duplicado: true };
      }
      throw erro;
    }
  }

  private async obterExistente(assinanteId: string, competencia: string) {
    return this.db.fatura.findFirst({
      where: { assinanteId, competencia },
      select: {
        id: true, assinanteId: true, assinaturaId: true, competencia: true,
        vencimentoEm: true, status: true, subtotalCentavos: true,
        totalCentavos: true, moeda: true,
      },
    });
  }
}
