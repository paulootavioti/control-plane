import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class AlterarStatusPlanoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(planoId: string, ativo: boolean, auditoria: ContextoAuditoria) {
    return this.db.$transaction(async (tx) => {
      const atual = await tx.plano.findUnique({
        where: { id: planoId },
        select: { id: true, nome: true, ativo: true, atualizadoEm: true },
      });
      if (!atual) throw new Error("PLANO_NAO_ENCONTRADO");

      if (atual.ativo === ativo) return { plano: atual, alterado: false };

      const plano = await tx.plano.update({
        where: { id: planoId },
        data: { ativo },
        select: { id: true, nome: true, ativo: true, atualizadoEm: true },
      });
      await tx.auditLogPlataforma.create({
        data: {
          ...auditoria,
          acao: ativo ? "PLANO_ATIVADO" : "PLANO_DESATIVADO",
          alvoTipo: "PLANO",
          alvoId: planoId,
          mudancas: { ativoAnterior: atual.ativo, ativo },
        },
      });

      return { plano, alterado: true };
    });
  }
}
