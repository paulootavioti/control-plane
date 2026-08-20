import { Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export class AlterarStatusOperadorService {
  constructor(private readonly db: PrismaClient) {}

  async execute(operadorId: string, ativo: boolean, auditoria: ContextoAuditoria) {
    if (!ativo && operadorId === auditoria.operadorId) {
      throw new Error("AUTODESATIVACAO_NAO_PERMITIDA");
    }

    return this.db.$transaction(async (tx) => {
      const atual = await tx.operadorPlataforma.findUnique({
        where: { id: operadorId },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true },
      });
      if (!atual) throw new Error("OPERADOR_NAO_ENCONTRADO");
      if (atual.ativo === ativo) return { ...atual, alterado: false };

      if (!ativo && atual.perfil === "ADMIN_PLATAFORMA") {
        const administradoresAtivos = await tx.operadorPlataforma.count({
          where: { perfil: "ADMIN_PLATAFORMA", ativo: true },
        });
        if (administradoresAtivos <= 1) throw new Error("ULTIMO_ADMIN_ATIVO");
      }

      const operador = await tx.operadorPlataforma.update({
        where: { id: operadorId },
        data: { ativo, versaoToken: { increment: 1 } },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true, atualizadoEm: true },
      });
      await tx.auditLogPlataforma.create({
        data: {
          ...auditoria,
          acao: ativo ? "OPERADOR_ATIVADO" : "OPERADOR_DESATIVADO",
          alvoTipo: "OPERADOR_PLATAFORMA",
          alvoId: operador.id,
          mudancas: { ativo: { de: atual.ativo, para: operador.ativo } },
        },
      });

      return { ...operador, alterado: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
