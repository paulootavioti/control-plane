import { createPublicKey } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { ContextoAuditoria } from "../auditoria/contextoAuditoria";

function normalizarChavePublica(valor: string): string {
  try {
    const chave = createPublicKey(valor.replace(/\\n/g, "\n").trim());
    if (chave.asymmetricKeyType !== "ed25519") throw new Error();
    return chave.export({ type: "spki", format: "pem" }).toString();
  } catch {
    throw new Error("CHAVE_PUBLICA_INVALIDA");
  }
}

export class ConfigurarChaveSnapshotService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, chavePublica: string, auditoria: ContextoAuditoria) {
    const normalizada = normalizarChavePublica(chavePublica);
    return this.db.$transaction(async (tx) => {
      const ambiente = await tx.ambienteTenant.findUnique({
        where: { assinanteId }, select: { id: true, provider: true },
      });
      if (!ambiente) throw new Error("AMBIENTE_NAO_ENCONTRADO");
      if (ambiente.provider !== "COMPARTILHADO") throw new Error("AMBIENTE_NAO_COMPARTILHADO");
      await tx.ambienteTenant.update({
        where: { id: ambiente.id }, data: { chavePublicaIntegracao: normalizada },
      });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria, assinanteId, acao: "CHAVE_SNAPSHOT_CONFIGURADA",
        alvoTipo: "AMBIENTE_TENANT", alvoId: ambiente.id,
        mudancas: { algoritmo: "Ed25519" },
      } });
      return { ambienteId: ambiente.id, chavePublicaConfigurada: true, algoritmo: "Ed25519" };
    });
  }
}
