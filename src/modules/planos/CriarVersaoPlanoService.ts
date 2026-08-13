import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface DadosNovaVersaoPlano {
  vigenteDesde: Date;
  vigenteAte?: Date | null;
  alunosPorBloco: number;
  precoPorBlocoCentavos: number;
  blocosMinimosPorUnidade: number;
  moeda: string;
  recursos: Record<string, boolean>;
  metadadosComerciais?: Prisma.InputJsonValue | null;
}

const selecaoVersao = {
  id: true,
  planoId: true,
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
} satisfies Prisma.PlanoVersaoSelect;

function jsonIgual(a: unknown, b: unknown) {
  const normalizar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(normalizar);
    if (valor && typeof valor === "object") {
      return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, item]) => [chave, normalizar(item)]));
    }
    return valor;
  };
  return JSON.stringify(normalizar(a)) === JSON.stringify(normalizar(b));
}

export class CriarVersaoPlanoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(planoId: string, dados: DadosNovaVersaoPlano, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const plano = await tx.plano.findUnique({
          where: { id: planoId },
          select: { id: true, ativo: true },
        });
        if (!plano) throw new Error("PLANO_NAO_ENCONTRADO");
        if (!plano.ativo) throw new Error("PLANO_INATIVO");

        const anterior = await tx.planoVersao.findFirst({
          where: { planoId },
          orderBy: [{ vigenteDesde: "desc" }, { versao: "desc" }],
          select: selecaoVersao,
        });
        if (!anterior) throw new Error("PLANO_SEM_VERSAO");

        if (anterior.vigenteDesde.getTime() === dados.vigenteDesde.getTime()) {
          const mesmaVersao = anterior.vigenteAte?.getTime() === (dados.vigenteAte?.getTime() ?? undefined)
            && anterior.alunosPorBloco === dados.alunosPorBloco
            && anterior.precoPorBlocoCentavos === dados.precoPorBlocoCentavos
            && anterior.blocosMinimosPorUnidade === dados.blocosMinimosPorUnidade
            && anterior.moeda === dados.moeda
            && jsonIgual(anterior.recursos, dados.recursos)
            && jsonIgual(anterior.metadadosComerciais, dados.metadadosComerciais ?? null);
          if (mesmaVersao) return { versao: anterior, criada: false };
          throw new Error("VIGENCIA_CONFLITANTE");
        }

        if (anterior.vigenteDesde >= dados.vigenteDesde) throw new Error("VIGENCIA_CONFLITANTE");
        if (anterior.vigenteAte && anterior.vigenteAte > dados.vigenteDesde) {
          throw new Error("VIGENCIA_SOBREPOSTA");
        }

        if (!anterior.vigenteAte) {
          await tx.planoVersao.update({
            where: { id: anterior.id },
            data: { vigenteAte: dados.vigenteDesde },
          });
        }

        const versao = await tx.planoVersao.create({
          data: {
            planoId,
            versao: anterior.versao + 1,
            vigenteDesde: dados.vigenteDesde,
            vigenteAte: dados.vigenteAte ?? null,
            alunosPorBloco: dados.alunosPorBloco,
            precoPorBlocoCentavos: dados.precoPorBlocoCentavos,
            blocosMinimosPorUnidade: dados.blocosMinimosPorUnidade,
            moeda: dados.moeda,
            recursos: dados.recursos,
            metadadosComerciais: dados.metadadosComerciais ?? undefined,
          },
          select: selecaoVersao,
        });

        await tx.auditLogPlataforma.create({
          data: {
            ...auditoria,
            acao: "PLANO_VERSAO_CRIADA",
            alvoTipo: "PLANO",
            alvoId: planoId,
            mudancas: {
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
        return { versao, criada: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(erro.code)) {
        throw new Error("VERSAO_CONCORRENTE");
      }
      throw erro;
    }
  }
}
