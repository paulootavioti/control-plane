import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface DadosNovoPlano {
  nome: string;
  descricao?: string;
  vigenteDesde: Date;
  vigenteAte?: Date | null;
  alunosPorBloco: number;
  precoPorBlocoCentavos: number;
  blocosMinimosPorUnidade: number;
  moeda: string;
  recursos: Record<string, boolean>;
  metadadosComerciais?: Prisma.InputJsonValue | null;
}

export class CriarPlanoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(dados: DadosNovoPlano, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const plano = await tx.plano.create({
          data: {
            nome: dados.nome,
            descricao: dados.descricao ?? null,
            ativo: true,
            versoes: {
              create: {
                versao: 1,
                vigenteDesde: dados.vigenteDesde,
                vigenteAte: dados.vigenteAte ?? null,
                alunosPorBloco: dados.alunosPorBloco,
                precoPorBlocoCentavos: dados.precoPorBlocoCentavos,
                blocosMinimosPorUnidade: dados.blocosMinimosPorUnidade,
                moeda: dados.moeda,
                recursos: dados.recursos,
                metadadosComerciais: dados.metadadosComerciais ?? undefined,
              },
            },
          },
          select: {
            id: true,
            nome: true,
            descricao: true,
            ativo: true,
            criadoEm: true,
            versoes: {
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
                criadoEm: true,
              },
            },
          },
        });

        const versao = plano.versoes[0];
        await tx.auditLogPlataforma.create({
          data: {
            ...auditoria,
            acao: "PLANO_CRIADO",
            alvoTipo: "PLANO",
            alvoId: plano.id,
            mudancas: {
              ativo: true,
              versao: versao.versao,
              vigenteDesde: versao.vigenteDesde.toISOString(),
              vigenteAte: versao.vigenteAte?.toISOString() ?? null,
              alunosPorBloco: versao.alunosPorBloco,
              precoPorBlocoCentavos: versao.precoPorBlocoCentavos,
              blocosMinimosPorUnidade: versao.blocosMinimosPorUnidade,
              moeda: versao.moeda,
              recursos: versao.recursos,
            },
          },
        });

        return plano;
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("PLANO_DUPLICADO");
      }
      throw erro;
    }
  }
}
