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
    include: {
      assinante: { select: { slug: true, produtoCodigo: true } },
      eventos: { where: { chaveIdempotencia }, take: 1, select: { id: true } },
    },
  });
  if (existente?.eventos[0]) return {
    ambienteId: existente.id, tenantKey: existente.tenantKey,
    eventoId: existente.eventos[0].id, duplicado: true,
  };

  if (existente?.provider === "COMPARTILHADO") {
    const agora = new Date();
    const evento = await tx.eventoProvisionamento.create({ data: {
      ambienteTenantId: existente.id,
      tipo: "CRIAR_AMBIENTE",
      chaveIdempotencia,
      status: "CONCLUIDO",
      etapaAtual: "HEALTH_CHECK_VALIDADO",
      iniciadoEm: agora,
      concluidoEm: agora,
    } });
    await tx.ambienteTenant.update({ where: { id: existente.id }, data: { status: "ATIVO" } });
    await tx.tenantProduto.update({
      where: { produtoCodigo_assinanteId: { produtoCodigo: existente.assinante.produtoCodigo, assinanteId: dados.assinanteId } },
      data: { status: "ATIVO" },
    });
    await tx.assinante.update({ where: { id: dados.assinanteId }, data: { status: "ATIVO" } });
    return { ambienteId: existente.id, tenantKey: existente.tenantKey, eventoId: evento.id, duplicado: false };
  }

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
