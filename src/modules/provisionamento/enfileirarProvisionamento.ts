import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface OpcoesProvisionamento {
  assinanteId: string;
  assinaturaId: string;
  regiao: string;
  schemaVersaoDesejada: string;
}

export async function enfileirarProvisionamento(
  tx: Prisma.TransactionClient,
  dados: OpcoesProvisionamento,
  auditoria: ContextoAuditoria,
) {
  const chaveIdempotencia = `criar-ambiente:${dados.assinanteId}:v1`;
  const existente = await tx.ambienteTenant.findUnique({
    where: { assinanteId: dados.assinanteId },
    include: { eventos: { where: { chaveIdempotencia }, take: 1, select: { id: true } } },
  });
  if (existente?.eventos[0]) return {
    ambienteId: existente.id, tenantKey: existente.tenantKey,
    eventoId: existente.eventos[0].id, duplicado: true,
  };

  const ambiente = await tx.ambienteTenant.create({ data: {
    assinanteId: dados.assinanteId,
    tenantKey: randomUUID(),
    regiao: dados.regiao,
    schemaVersaoDesejada: dados.schemaVersaoDesejada,
    eventos: { create: { tipo: "CRIAR_AMBIENTE", chaveIdempotencia } },
  }, include: { eventos: { where: { chaveIdempotencia }, select: { id: true } } } });
  await tx.assinante.update({ where: { id: dados.assinanteId }, data: { status: "EM_PROVISIONAMENTO" } });
  await tx.auditLogPlataforma.create({ data: {
    ...auditoria, assinanteId: dados.assinanteId, acao: "PROVISIONAMENTO_SOLICITADO",
    alvoTipo: "AMBIENTE_TENANT", alvoId: ambiente.id,
    mudancas: { assinaturaId: dados.assinaturaId, regiao: dados.regiao,
      schemaVersaoDesejada: dados.schemaVersaoDesejada },
  } });
  return { ambienteId: ambiente.id, tenantKey: ambiente.tenantKey,
    eventoId: ambiente.eventos[0].id, duplicado: false };
}
