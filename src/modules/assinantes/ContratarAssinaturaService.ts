import { Prisma, PrismaClient, StatusAssinatura } from "@prisma/client";

export interface DadosContratacao {
  planoVersaoId: string;
  status: Extract<StatusAssinatura, "TESTE" | "ATIVA">;
  testeAte?: Date;
  diaVencimento: number;
  alunosPorBlocoNegociado?: number | null;
  precoPorBlocoCentavosNegociado?: number | null;
  blocosMinimosPorUnidadeNegociado?: number | null;
}

export class ContratarAssinaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, dados: DadosContratacao, agora = new Date()) {
    if (dados.status === "TESTE" && (!dados.testeAte || dados.testeAte <= agora)) {
      throw new Error("PERIODO_TESTE_INVALIDO");
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const assinante = await tx.assinante.findUnique({
          where: { id: assinanteId }, select: { status: true },
        });
        if (!assinante) throw new Error("ASSINANTE_NAO_ENCONTRADO");
        if (assinante.status !== "PROSPECT") throw new Error("ASSINANTE_NAO_ELEGIVEL");

        const corrente = await tx.assinatura.findFirst({
          where: { assinanteId, encerradaEm: null }, select: { id: true },
        });
        if (corrente) throw new Error("ASSINATURA_CORRENTE_EXISTE");

        const planoVersao = await tx.planoVersao.findUnique({
          where: { id: dados.planoVersaoId },
          select: { id: true, vigenteDesde: true, vigenteAte: true, plano: { select: { ativo: true } } },
        });
        if (!planoVersao || !planoVersao.plano.ativo || planoVersao.vigenteDesde > agora ||
          (planoVersao.vigenteAte && planoVersao.vigenteAte <= agora)) {
          throw new Error("PLANO_VERSAO_NAO_ELEGIVEL");
        }

        return tx.assinatura.create({
          data: {
            assinanteId,
            planoVersaoId: planoVersao.id,
            status: dados.status,
            inicioEm: agora,
            testeAte: dados.status === "TESTE" ? dados.testeAte : null,
            diaVencimento: dados.diaVencimento,
            alunosPorBlocoNegociado: dados.alunosPorBlocoNegociado ?? null,
            precoPorBlocoCentavosNegociado: dados.precoPorBlocoCentavosNegociado ?? null,
            blocosMinimosPorUnidadeNegociado: dados.blocosMinimosPorUnidadeNegociado ?? null,
          },
          select: { id: true, assinanteId: true, planoVersaoId: true, status: true, inicioEm: true, testeAte: true, diaVencimento: true },
        });
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("ASSINATURA_CORRENTE_EXISTE");
      }
      throw erro;
    }
  }
}
