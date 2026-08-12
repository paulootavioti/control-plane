import { PrismaClient, StatusAssinatura } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

const TRANSICOES: Record<StatusAssinatura, StatusAssinatura[]> = {
  TESTE: ["ATIVA", "SUSPENSA", "CANCELADA"],
  ATIVA: ["INADIMPLENTE", "SUSPENSA", "CANCELADA"],
  INADIMPLENTE: ["ATIVA", "SUSPENSA", "CANCELADA"],
  SUSPENSA: ["ATIVA", "CANCELADA"],
  CANCELADA: [],
};

export class AlterarStatusAssinaturaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, assinaturaId: string, destino: StatusAssinatura, auditoria: ContextoAuditoria, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const assinatura = await tx.assinatura.findUnique({
        where: { id_assinanteId: { id: assinaturaId, assinanteId } },
        select: { id: true, status: true, encerradaEm: true },
      });
      if (!assinatura || assinatura.encerradaEm) throw new Error("ASSINATURA_NAO_ENCONTRADA");
      if (assinatura.status === destino) throw new Error("STATUS_JA_APLICADO");
      if (!TRANSICOES[assinatura.status].includes(destino)) throw new Error("TRANSICAO_INVALIDA");

      const ambiente = await tx.ambienteTenant.findUnique({
        where: { assinanteId }, select: { id: true, status: true },
      });
      await tx.assinatura.update({
        where: { id: assinatura.id },
        data: { status: destino, canceladaEm: destino === "CANCELADA" ? agora : null },
      });

      if (destino === "SUSPENSA") {
        await tx.assinante.update({ where: { id: assinanteId }, data: { status: "SUSPENSO" } });
        if (ambiente && ambiente.status !== "DESATIVADO") {
          await tx.ambienteTenant.update({ where: { id: ambiente.id }, data: { status: "SUSPENSO" } });
        }
      } else if (destino === "CANCELADA") {
        await tx.assinante.update({ where: { id: assinanteId }, data: { status: "CANCELADO" } });
      } else if (destino === "ATIVA" && ambiente && ["ATIVO", "SUSPENSO"].includes(ambiente.status)) {
        await tx.assinante.update({ where: { id: assinanteId }, data: { status: "ATIVO" } });
        if (ambiente.status === "SUSPENSO") {
          await tx.ambienteTenant.update({ where: { id: ambiente.id }, data: { status: "ATIVO" } });
        }
      }

      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId,
        acao: "ASSINATURA_STATUS_ALTERADO",
        alvoTipo: "ASSINATURA",
        alvoId: assinatura.id,
        mudancas: { statusAnterior: assinatura.status, status: destino, ambienteId: ambiente?.id ?? null },
      } });

      return {
        assinaturaId: assinatura.id,
        statusAnterior: assinatura.status,
        status: destino,
        ambienteId: ambiente?.id ?? null,
        exigeEnvioConcessao: Boolean(ambiente),
      };
    });
  }
}
