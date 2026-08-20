import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class TrocarPlanoAssinaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(
    assinanteId: string,
    assinaturaId: string,
    planoId: string,
    auditoria: ContextoAuditoria,
    agora = new Date(),
  ) {
    try {
      return await this.db.$transaction(async (tx) => {
        const assinante = await tx.assinante.findUnique({
          where: { id: assinanteId },
          select: { id: true },
        });
        if (!assinante) throw new Error("ASSINANTE_NAO_ENCONTRADO");

        const atual = await tx.assinatura.findUnique({
          where: { id_assinanteId: { id: assinaturaId, assinanteId } },
          select: {
            id: true,
            planoVersaoId: true,
            status: true,
            inicioEm: true,
            testeAte: true,
            canceladaEm: true,
            encerradaEm: true,
            diaVencimento: true,
            alunosPorBlocoNegociado: true,
            precoPorBlocoCentavosNegociado: true,
            blocosMinimosPorUnidadeNegociado: true,
            politicaCobranca: true,
            planoVersao: { select: { planoId: true } },
          },
        });
        if (!atual) throw new Error("ASSINATURA_NAO_ENCONTRADA");

        const versaoAlvo = await tx.planoVersao.findFirst({
          where: {
            planoId,
            vigenteDesde: { lte: agora },
            OR: [{ vigenteAte: null }, { vigenteAte: { gt: agora } }],
            plano: { ativo: true },
          },
          orderBy: [{ vigenteDesde: "desc" }, { versao: "desc" }],
          select: { id: true, planoId: true, versao: true },
        });
        if (!versaoAlvo) throw new Error("PLANO_NAO_ELEGIVEL");

        if (atual.encerradaEm) {
          const sucessora = await tx.assinatura.findFirst({
            where: {
              assinanteId,
              inicioEm: atual.encerradaEm,
              planoVersao: { planoId },
            },
            select: { id: true, planoVersaoId: true, status: true, inicioEm: true },
          });
          if (sucessora) {
            return { assinaturaAnteriorId: atual.id, assinatura: sucessora, alterada: false };
          }
          throw new Error("ASSINATURA_ENCERRADA");
        }
        if (atual.status === "CANCELADA") throw new Error("ASSINATURA_NAO_ELEGIVEL");
        if (atual.planoVersao.planoId === planoId) throw new Error("PLANO_JA_APLICADO");

        const outraCorrente = await tx.assinatura.findFirst({
          where: { assinanteId, encerradaEm: null, id: { not: atual.id } },
          select: { id: true },
        });
        if (outraCorrente) throw new Error("ASSINATURA_CORRENTE_CONFLITANTE");

        await tx.assinatura.update({
          where: { id: atual.id },
          data: { encerradaEm: agora },
        });
        const nova = await tx.assinatura.create({
          data: {
            assinanteId,
            planoVersaoId: versaoAlvo.id,
            status: atual.status,
            inicioEm: agora,
            testeAte: atual.testeAte,
            diaVencimento: atual.diaVencimento,
            alunosPorBlocoNegociado: atual.alunosPorBlocoNegociado,
            precoPorBlocoCentavosNegociado: atual.precoPorBlocoCentavosNegociado,
            blocosMinimosPorUnidadeNegociado: atual.blocosMinimosPorUnidadeNegociado,
            politicaCobranca: atual.politicaCobranca ?? undefined,
          },
          select: {
            id: true,
            assinanteId: true,
            planoVersaoId: true,
            status: true,
            inicioEm: true,
            testeAte: true,
            diaVencimento: true,
          },
        });
        await tx.auditLogPlataforma.create({
          data: {
            ...auditoria,
            assinanteId,
            acao: "ASSINATURA_PLANO_ALTERADO",
            alvoTipo: "ASSINATURA",
            alvoId: nova.id,
            mudancas: {
              assinaturaAnteriorId: atual.id,
              assinaturaId: nova.id,
              planoVersaoAnteriorId: atual.planoVersaoId,
              planoVersaoId: nova.planoVersaoId,
              versaoPlano: versaoAlvo.versao,
              inicioEm: nova.inicioEm.toISOString(),
            },
          },
        });

        return { assinaturaAnteriorId: atual.id, assinatura: nova, alterada: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(erro.code)) {
        throw new Error("TROCA_PLANO_CONCORRENTE");
      }
      throw erro;
    }
  }
}
