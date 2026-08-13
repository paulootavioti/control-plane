import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

const selecaoFatura = {
  id: true, assinanteId: true, assinaturaId: true, competencia: true,
  status: true, totalCentavos: true, moeda: true, gateway: true,
  gatewayFaturaId: true, pagaEm: true,
} as const;

export class RegistrarPagamentoFaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(
    faturaId: string,
    gateway: string,
    referenciaPagamento: string,
    auditoria: ContextoAuditoria,
    agora = new Date(),
  ) {
    try {
      return await this.db.$transaction(async (tx) => {
        const existente = await tx.fatura.findUnique({ where: { id: faturaId }, select: selecaoFatura });
        if (!existente) throw new Error("FATURA_NAO_ENCONTRADA");
        if (existente.status === "PAGA") {
          if (existente.gateway === gateway && existente.gatewayFaturaId === referenciaPagamento) {
            return { ...existente, duplicado: true };
          }
          throw new Error("FATURA_JA_PAGA");
        }
        if (!["ABERTA", "VENCIDA"].includes(existente.status)) throw new Error("FATURA_NAO_PAGAVEL");

        const adquirido = await tx.fatura.updateMany({
          where: { id: faturaId, status: { in: ["ABERTA", "VENCIDA"] } },
          data: {
            status: "PAGA", pagaEm: agora, gateway,
            gatewayFaturaId: referenciaPagamento,
          },
        });
        if (adquirido.count === 0) {
          const concorrente = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
          if (
            concorrente.status === "PAGA" &&
            concorrente.gateway === gateway &&
            concorrente.gatewayFaturaId === referenciaPagamento
          ) return { ...concorrente, duplicado: true };
          throw new Error("FATURA_NAO_PAGAVEL");
        }

        const fatura = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId: fatura.assinanteId,
          acao: "FATURA_PAGA",
          alvoTipo: "FATURA",
          alvoId: fatura.id,
          mudancas: {
            statusAnterior: existente.status,
            statusAtual: "PAGA",
            competencia: fatura.competencia,
            totalCentavos: fatura.totalCentavos,
            gateway,
            referenciaPagamento,
          },
        } });
        return { ...fatura, duplicado: false };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("REFERENCIA_PAGAMENTO_JA_UTILIZADA");
      }
      throw erro;
    }
  }
}
