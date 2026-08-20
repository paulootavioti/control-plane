import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class MarcarFaturasVencidasService {
  constructor(private readonly db: PrismaClient) {}

  async execute(auditoria: ContextoAuditoria, agora = new Date(), limite = 100) {
    return this.db.$transaction(async (tx) => {
      const candidatas = await tx.fatura.findMany({
        where: { status: "ABERTA", vencimentoEm: { lt: agora } },
        orderBy: [{ vencimentoEm: "asc" }, { id: "asc" }],
        take: limite,
        select: {
          id: true, assinanteId: true, assinaturaId: true,
          competencia: true, vencimentoEm: true, totalCentavos: true,
        },
      });

      const faturasIds: string[] = [];
      for (const fatura of candidatas) {
        const adquirida = await tx.fatura.updateMany({
          where: { id: fatura.id, status: "ABERTA", vencimentoEm: { lt: agora } },
          data: { status: "VENCIDA" },
        });
        if (adquirida.count === 0) continue;

        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId: fatura.assinanteId,
          acao: "FATURA_MARCADA_VENCIDA",
          alvoTipo: "FATURA",
          alvoId: fatura.id,
          mudancas: {
            statusAnterior: "ABERTA",
            statusAtual: "VENCIDA",
            competencia: fatura.competencia,
            vencimentoEm: fatura.vencimentoEm,
            totalCentavos: fatura.totalCentavos,
          },
        } });
        faturasIds.push(fatura.id);
      }

      return {
        processadas: faturasIds.length,
        faturasIds,
        possuiMais: candidatas.length === limite,
      };
    });
  }
}
