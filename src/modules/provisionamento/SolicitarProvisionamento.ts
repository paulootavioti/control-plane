import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export type DadosSolicitacao = {
  assinanteId: string;
  regiao: string;
  schemaVersaoDesejada: string;
};

export class SolicitarProvisionamento {
  constructor(private readonly db: PrismaClient) {}

  async execute(dados: DadosSolicitacao, auditoria: ContextoAuditoria) {
    const chaveIdempotencia = `criar-ambiente:${dados.assinanteId}:v1`;
    const existente = await this.obterExistente(dados.assinanteId, chaveIdempotencia);
    if (existente) return { ...existente, duplicado: true };

    try {
      return await this.db.$transaction(async (tx) => {
        const assinante = await tx.assinante.findUnique({
          where: { id: dados.assinanteId }, select: { id: true, status: true },
        });
        if (!assinante) throw new Error("ASSINANTE_NAO_ENCONTRADO");
        if (["CANCELADO", "SUSPENSO"].includes(assinante.status)) {
          throw new Error("ASSINANTE_NAO_ELEGIVEL");
        }

        const assinatura = await tx.assinatura.findFirst({
          where: {
            assinanteId: dados.assinanteId,
            encerradaEm: null,
            status: { in: ["TESTE", "ATIVA"] },
          },
          select: { id: true },
        });
        if (!assinatura) throw new Error("ASSINATURA_NAO_ELEGIVEL");

        const ambiente = await tx.ambienteTenant.create({ data: {
          assinanteId: dados.assinanteId,
          tenantKey: randomUUID(),
          regiao: dados.regiao,
          schemaVersaoDesejada: dados.schemaVersaoDesejada,
          eventos: { create: { tipo: "CRIAR_AMBIENTE", chaveIdempotencia } },
        }, include: { eventos: { where: { chaveIdempotencia }, select: { id: true } } } });
        await tx.assinante.update({
          where: { id: dados.assinanteId }, data: { status: "EM_PROVISIONAMENTO" },
        });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId: dados.assinanteId,
          acao: "PROVISIONAMENTO_SOLICITADO",
          alvoTipo: "AMBIENTE_TENANT",
          alvoId: ambiente.id,
          mudancas: {
            assinaturaId: assinatura.id,
            regiao: dados.regiao,
            schemaVersaoDesejada: dados.schemaVersaoDesejada,
          },
        } });
        return { ambienteId: ambiente.id, tenantKey: ambiente.tenantKey, eventoId: ambiente.eventos[0].id, duplicado: false };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        const concorrente = await this.obterExistente(dados.assinanteId, chaveIdempotencia);
        if (concorrente) return { ...concorrente, duplicado: true };
      }
      throw erro;
    }
  }

  private async obterExistente(assinanteId: string, chaveIdempotencia: string) {
    const ambiente = await this.db.ambienteTenant.findUnique({
      where: { assinanteId },
      include: { eventos: { where: { chaveIdempotencia }, take: 1, select: { id: true } } },
    });
    if (!ambiente?.eventos[0]) return null;
    return { ambienteId: ambiente.id, tenantKey: ambiente.tenantKey, eventoId: ambiente.eventos[0].id };
  }
}
