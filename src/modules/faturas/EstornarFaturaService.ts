import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

const selecaoFatura = {
  id: true, assinanteId: true, assinaturaId: true, competencia: true,
  status: true, totalCentavos: true, moeda: true, gateway: true,
  gatewayFaturaId: true, pagaEm: true, estornadaEm: true,
} as const;

export class EstornarFaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(faturaId: string, motivo: string, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const existente = await tx.fatura.findUnique({ where: { id: faturaId }, select: selecaoFatura });
      if (!existente) throw new Error("FATURA_NAO_ENCONTRADA");
      if (existente.status === "ESTORNADA") return { ...existente, duplicado: true };
      if (existente.status !== "PAGA") throw new Error("FATURA_NAO_ESTORNAVEL");

      const adquirido = await tx.fatura.updateMany({
        where: { id: faturaId, status: "PAGA" },
        data: { status: "ESTORNADA", estornadaEm: agora },
      });
      if (adquirido.count === 0) {
        const concorrente = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
        if (concorrente.status === "ESTORNADA") return { ...concorrente, duplicado: true };
        throw new Error("FATURA_NAO_ESTORNAVEL");
      }

      const fatura = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId: fatura.assinanteId,
        acao: "FATURA_ESTORNADA",
        alvoTipo: "FATURA",
        alvoId: fatura.id,
        mudancas: {
          statusAnterior: "PAGA",
          statusAtual: "ESTORNADA",
          competencia: fatura.competencia,
          totalCentavos: fatura.totalCentavos,
          gateway: fatura.gateway,
          referenciaPagamento: fatura.gatewayFaturaId,
          motivo,
        },
      } });
      return { ...fatura, duplicado: false, exigeRevisaoComercial: true };
    });
  }
}
