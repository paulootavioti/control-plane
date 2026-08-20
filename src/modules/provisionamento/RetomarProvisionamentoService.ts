import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class RetomarProvisionamentoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(eventoId: string, auditoria: ContextoAuditoria) {
    return this.db.$transaction(async (tx) => {
      const evento = await tx.eventoProvisionamento.findUnique({
        where: { id: eventoId },
        select: {
          id: true,
          status: true,
          tentativas: true,
          etapaAtual: true,
          ambiente: { select: { id: true, assinanteId: true } },
        },
      });
      if (!evento) throw new Error("EVENTO_NAO_ENCONTRADO");

      if (["PENDENTE", "EXECUTANDO"].includes(evento.status)) {
        return { eventoId: evento.id, ambienteId: evento.ambiente.id, duplicado: true };
      }
      if (evento.status !== "FALHOU" || evento.tentativas < 5) {
        throw new Error("EVENTO_NAO_ELEGIVEL");
      }

      const assinatura = await tx.assinatura.findFirst({
        where: {
          assinanteId: evento.ambiente.assinanteId,
          encerradaEm: null,
          status: { in: ["TESTE", "ATIVA"] },
        },
        select: { id: true },
      });
      if (!assinatura) throw new Error("ASSINATURA_NAO_ELEGIVEL");

      const adquirido = await tx.eventoProvisionamento.updateMany({
        where: { id: evento.id, status: "FALHOU", tentativas: { gte: 5 } },
        data: {
          status: "PENDENTE",
          tentativas: 0,
          erroSanitizado: null,
          iniciadoEm: null,
          concluidoEm: null,
          proximaTentativaEm: null,
        },
      });
      if (adquirido.count === 0) {
        return { eventoId: evento.id, ambienteId: evento.ambiente.id, duplicado: true };
      }
      await tx.ambienteTenant.update({
        where: { id: evento.ambiente.id },
        data: { status: "PENDENTE", assinante: { update: { status: "EM_PROVISIONAMENTO" } } },
      });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId: evento.ambiente.assinanteId,
        acao: "PROVISIONAMENTO_RETOMADO",
        alvoTipo: "EVENTO_PROVISIONAMENTO",
        alvoId: evento.id,
        mudancas: { assinaturaId: assinatura.id, retomadaDeEtapa: evento.etapaAtual },
      } });

      return { eventoId: evento.id, ambienteId: evento.ambiente.id, duplicado: false };
    });
  }
}
