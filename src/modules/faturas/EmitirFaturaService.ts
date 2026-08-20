import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

const selecaoFatura = {
  id: true,
  assinanteId: true,
  assinaturaId: true,
  competencia: true,
  vencimentoEm: true,
  status: true,
  totalCentavos: true,
  moeda: true,
  emitidaEm: true,
} as const;

export class EmitirFaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(faturaId: string, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const existente = await tx.fatura.findUnique({
        where: { id: faturaId },
        select: selecaoFatura,
      });
      if (!existente) throw new Error("FATURA_NAO_ENCONTRADA");
      if (existente.status === "ABERTA") return { ...existente, duplicado: true };
      if (existente.status !== "RASCUNHO") throw new Error("FATURA_NAO_EMITIVEL");

      const adquirido = await tx.fatura.updateMany({
        where: { id: faturaId, status: "RASCUNHO" },
        data: { status: "ABERTA", emitidaEm: agora },
      });
      if (adquirido.count === 0) {
        const concorrente = await tx.fatura.findUniqueOrThrow({
          where: { id: faturaId },
          select: selecaoFatura,
        });
        if (concorrente.status === "ABERTA") return { ...concorrente, duplicado: true };
        throw new Error("FATURA_NAO_EMITIVEL");
      }

      const fatura = await tx.fatura.findUniqueOrThrow({
        where: { id: faturaId },
        select: selecaoFatura,
      });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId: fatura.assinanteId,
        acao: "FATURA_EMITIDA",
        alvoTipo: "FATURA",
        alvoId: fatura.id,
        mudancas: {
          statusAnterior: "RASCUNHO",
          statusAtual: "ABERTA",
          competencia: fatura.competencia,
          totalCentavos: fatura.totalCentavos,
        },
      } });
      return { ...fatura, duplicado: false };
    });
  }
}
