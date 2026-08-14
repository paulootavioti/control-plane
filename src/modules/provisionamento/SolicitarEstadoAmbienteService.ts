import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";
type Operacao = "SUSPENDER" | "REATIVAR";

export class SolicitarEstadoAmbienteService {
  constructor(private readonly db: PrismaClient) {}
  async execute(ambienteId: string, operacao: Operacao, auditoria: ContextoAuditoria) {
    return this.db.$transaction(async (tx) => {
      const ambiente = await tx.ambienteTenant.findUnique({ where: { id: ambienteId }, select: { id: true, assinanteId: true, status: true, atualizadoEm: true } });
      if (!ambiente) throw new Error("AMBIENTE_NAO_ENCONTRADO");
      const esperado = operacao === "SUSPENDER" ? "ATIVO" : "SUSPENSO";
      if (ambiente.status !== esperado) throw new Error("AMBIENTE_NAO_ELEGIVEL");
      if (operacao === "REATIVAR") {
        const assinatura = await tx.assinatura.findFirst({ where: { assinanteId: ambiente.assinanteId, encerradaEm: null, status: { in: ["TESTE", "ATIVA"] } }, select: { id: true } });
        if (!assinatura) throw new Error("ASSINATURA_NAO_ELEGIVEL");
      }
      const chave = `${operacao.toLowerCase()}:${ambienteId}:${ambiente.atualizadoEm.toISOString()}`;
      const existente = await tx.eventoProvisionamento.findUnique({ where: { chaveIdempotencia: chave }, select: { id: true } });
      if (existente) return { ambienteId, eventoId: existente.id, duplicado: true };
      const evento = await tx.eventoProvisionamento.create({ data: { ambienteTenantId: ambienteId, tipo: operacao, chaveIdempotencia: chave }, select: { id: true } });
      await tx.auditLogPlataforma.create({ data: { ...auditoria, assinanteId: ambiente.assinanteId, acao: `AMBIENTE_${operacao}_SOLICITADO`, alvoTipo: "AMBIENTE_TENANT", alvoId: ambienteId, mudancas: { estadoAtual: ambiente.status } } });
      return { ambienteId, eventoId: evento.id, duplicado: false };
    });
  }
}
