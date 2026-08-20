import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

const selecaoFatura = {
  id: true,
  assinanteId: true,
  assinaturaId: true,
  competencia: true,
  status: true,
  totalCentavos: true,
  moeda: true,
  canceladaEm: true,
} as const;

export class CancelarFaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(faturaId: string, motivo: string, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const existente = await tx.fatura.findUnique({ where: { id: faturaId }, select: selecaoFatura });
      if (!existente) throw new Error("FATURA_NAO_ENCONTRADA");
      if (existente.status === "CANCELADA") return { ...existente, duplicado: true };
      if (!["RASCUNHO", "ABERTA"].includes(existente.status)) throw new Error("FATURA_NAO_CANCELAVEL");

      const adquirido = await tx.fatura.updateMany({
        where: { id: faturaId, status: { in: ["RASCUNHO", "ABERTA"] } },
        data: { status: "CANCELADA", canceladaEm: agora },
      });
      if (adquirido.count === 0) {
        const concorrente = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
        if (concorrente.status === "CANCELADA") return { ...concorrente, duplicado: true };
        throw new Error("FATURA_NAO_CANCELAVEL");
      }

      const fatura = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId: fatura.assinanteId,
        acao: "FATURA_CANCELADA",
        alvoTipo: "FATURA",
        alvoId: fatura.id,
        mudancas: {
          statusAnterior: existente.status,
          statusAtual: "CANCELADA",
          competencia: fatura.competencia,
          totalCentavos: fatura.totalCentavos,
          motivo,
        },
      } });
      return { ...fatura, duplicado: false };
    });
  }
}
