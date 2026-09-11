import { PrismaClient } from "@prisma/client";

import { assinarConcessao, extrairRecursos, statusAcesso } from "./concessaoContrato";

function chavePrivada(): string {
  const valor = process.env.CONTROL_PLANE_GRANT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!valor?.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("CONCESSAO_CHAVE_PRIVADA_AUSENTE");
  }
  return valor;
}

export class GerarConcessaoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(ambienteId: string, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const ambiente = await tx.ambienteTenant.update({
        where: { id: ambienteId },
        data: { revisaoConcessao: { increment: 1 }, ultimaConcessaoEmitidaEm: agora },
        select: { tenantKey: true, assinanteId: true, revisaoConcessao: true },
      });
      const assinatura = await tx.assinatura.findFirst({
        where: { assinanteId: ambiente.assinanteId, encerradaEm: null },
        include: { planoVersao: { select: { recursos: true } } },
      });
      if (!assinatura) throw new Error("Assinante não possui assinatura corrente.");

      const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
      const payload = {
        versao: 1,
        tenantKey: ambiente.tenantKey,
        revisao: ambiente.revisaoConcessao,
        statusAcesso: statusAcesso(assinatura.status),
        recursos: extrairRecursos(assinatura.planoVersao.recursos),
        emitidaEm: agora.toISOString(),
        expiraEm: expiraEm.toISOString(),
      } as const;
      try { return assinarConcessao(payload, chavePrivada()); }
      catch (erro) {
        if (erro instanceof Error && erro.message === "CONCESSAO_CHAVE_PRIVADA_AUSENTE") throw erro;
        throw new Error("CONCESSAO_CHAVE_PRIVADA_INVALIDA");
      }
    });
  }
}
