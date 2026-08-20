import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class SolicitarAtualizacaoSchemaService {
  constructor(private readonly db: PrismaClient) {}
  async execute(ambienteId: string, versao: string, auditoria: ContextoAuditoria) {
    return this.db.$transaction(async (tx) => {
      const ambiente = await tx.ambienteTenant.findUnique({ where: { id: ambienteId }, select: { id: true, assinanteId: true, status: true, schemaVersaoAtual: true, schemaVersaoDesejada: true } });
      if (!ambiente) throw new Error("AMBIENTE_NAO_ENCONTRADO");
      if (ambiente.status !== "ATIVO") throw new Error("AMBIENTE_NAO_ELEGIVEL");
      if (ambiente.schemaVersaoAtual === versao) return { ambienteId, duplicado: true, eventoId: null };
      const chave = `migrations:${ambienteId}:${versao}`;
      const existente = await tx.eventoProvisionamento.findUnique({ where: { chaveIdempotencia: chave }, select: { id: true } });
      if (existente) return { ambienteId, eventoId: existente.id, duplicado: true };
      const evento = await tx.eventoProvisionamento.create({ data: { ambienteTenantId: ambienteId, tipo: "APLICAR_MIGRATIONS", chaveIdempotencia: chave }, select: { id: true } });
      await tx.ambienteTenant.update({ where: { id: ambienteId }, data: { schemaVersaoDesejada: versao } });
      await tx.auditLogPlataforma.create({ data: { ...auditoria, assinanteId: ambiente.assinanteId, acao: "ATUALIZACAO_SCHEMA_SOLICITADA", alvoTipo: "AMBIENTE_TENANT", alvoId: ambienteId, mudancas: { de: ambiente.schemaVersaoDesejada, para: versao } } });
      return { ambienteId, eventoId: evento.id, duplicado: false };
    });
  }
}
