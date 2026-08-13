import { PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";
import { criarSenhaHash } from "../auth/regrasAuth";

export class RedefinirSenhaOperadorService {
  constructor(private readonly db: PrismaClient) {}

  async execute(operadorId: string, senha: string, auditoria: ContextoAuditoria) {
    const senhaHash = await criarSenhaHash(senha);

    return this.db.$transaction(async (tx) => {
      const existente = await tx.operadorPlataforma.findUnique({
        where: { id: operadorId },
        select: { id: true },
      });
      if (!existente) throw new Error("OPERADOR_NAO_ENCONTRADO");

      const operador = await tx.operadorPlataforma.update({
        where: { id: operadorId },
        data: { senhaHash, versaoToken: { increment: 1 } },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          ativo: true,
          atualizadoEm: true,
        },
      });
      await tx.auditLogPlataforma.create({
        data: {
          ...auditoria,
          acao: "SENHA_OPERADOR_REDEFINIDA",
          alvoTipo: "OPERADOR_PLATAFORMA",
          alvoId: operador.id,
          mudancas: { sessoesAnterioresInvalidadas: true },
        },
      });

      return operador;
    });
  }
}
