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
            return {
              ...existente, duplicado: true, regularizouAssinatura: false,
              ambienteId: null, exigeEnvioConcessao: false,
            };
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
          ) return {
            ...concorrente, duplicado: true, regularizouAssinatura: false,
            ambienteId: null, exigeEnvioConcessao: false,
          };
          throw new Error("FATURA_NAO_PAGAVEL");
        }

        const fatura = await tx.fatura.findUniqueOrThrow({ where: { id: faturaId }, select: selecaoFatura });
        const assinatura = await tx.assinatura.findUnique({
          where: { id_assinanteId: { id: fatura.assinaturaId, assinanteId: fatura.assinanteId } },
          select: { id: true, status: true, encerradaEm: true },
        });
        let regularizouAssinatura = false;
        let ambienteId: string | null = null;
        if (assinatura?.status === "INADIMPLENTE" && !assinatura.encerradaEm) {
          const pendencias = await tx.fatura.count({
            where: {
              assinaturaId: assinatura.id,
              id: { not: fatura.id },
              OR: [
                { status: "VENCIDA" },
                { status: "ABERTA", vencimentoEm: { lt: agora } },
              ],
            },
          });
          if (pendencias === 0) {
            const ambiente = await tx.ambienteTenant.findUnique({
              where: { assinanteId: fatura.assinanteId }, select: { id: true, status: true },
            });
            if (!ambiente || ambiente.status === "ATIVO") {
              await tx.assinatura.update({ where: { id: assinatura.id }, data: { status: "ATIVA" } });
              ambienteId = ambiente?.id ?? null;
              regularizouAssinatura = true;
              await tx.auditLogPlataforma.create({ data: {
                ...auditoria,
                assinanteId: fatura.assinanteId,
                acao: "ASSINATURA_REGULARIZADA_POR_PAGAMENTO",
                alvoTipo: "ASSINATURA",
                alvoId: assinatura.id,
                mudancas: {
                  statusAnterior: "INADIMPLENTE",
                  statusAtual: "ATIVA",
                  faturaId: fatura.id,
                  ambienteId,
                },
              } });
            }
          }
        }
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
        return {
          ...fatura,
          duplicado: false,
          regularizouAssinatura,
          ambienteId,
          exigeEnvioConcessao: regularizouAssinatura && Boolean(ambienteId),
        };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("REFERENCIA_PAGAMENTO_JA_UTILIZADA");
      }
      throw erro;
    }
  }
}
