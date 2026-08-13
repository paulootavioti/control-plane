import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface DadosAtualizacaoAssinante {
  nomeFantasia?: string;
  razaoSocial?: string | null;
  documento?: string;
  emailCobranca?: string;
  telefone?: string | null;
  slug?: string;
}

const selecaoAssinante = {
  id: true, nomeFantasia: true, razaoSocial: true, documento: true,
  emailCobranca: true, telefone: true, slug: true, status: true,
  criadoEm: true, atualizadoEm: true,
} satisfies Prisma.AssinanteSelect;

export class AtualizarAssinanteService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, dados: DadosAtualizacaoAssinante, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const atual = await tx.assinante.findUnique({ where: { id: assinanteId }, select: selecaoAssinante });
        if (!atual) throw new Error("ASSINANTE_NAO_ENCONTRADO");

        const alteracoes = Object.fromEntries(Object.entries(dados).filter(
          ([campo, valor]) => atual[campo as keyof typeof atual] !== valor,
        )) as DadosAtualizacaoAssinante;
        if (!Object.keys(alteracoes).length) return { assinante: atual, alterado: false };

        const mudancas: Record<string, Prisma.InputJsonValue> = {};
        for (const [campo, valor] of Object.entries(alteracoes)) {
          if (["documento", "emailCobranca", "telefone"].includes(campo)) {
            mudancas[campo] = { alterado: true };
          } else {
            mudancas[campo] = {
              de: String(atual[campo as keyof typeof atual] ?? ""),
              para: String(valor ?? ""),
            };
          }
        }

        const assinante = await tx.assinante.update({
          where: { id: assinanteId }, data: alteracoes, select: selecaoAssinante,
        });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId,
          acao: "ASSINANTE_ATUALIZADO",
          alvoTipo: "ASSINANTE",
          alvoId: assinanteId,
          mudancas: mudancas as Prisma.InputJsonObject,
        } });
        return { assinante, alterado: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("ASSINANTE_DUPLICADO");
      }
      throw erro;
    }
  }
}
