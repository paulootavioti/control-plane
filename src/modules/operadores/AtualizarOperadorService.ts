import { PerfilOperador, Prisma, PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface DadosAtualizacaoOperador { nome: string; email: string; perfil: PerfilOperador; }

export class AtualizarOperadorService {
  constructor(private readonly db: PrismaClient) {}

  async execute(operadorId: string, dados: DadosAtualizacaoOperador, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const atual = await tx.operadorPlataforma.findUnique({
          where: { id: operadorId },
          select: { id: true, nome: true, email: true, perfil: true, ativo: true },
        });
        if (!atual) throw new Error("OPERADOR_NAO_ENCONTRADO");
        const rebaixamento = atual.perfil === "ADMIN_PLATAFORMA" && dados.perfil !== "ADMIN_PLATAFORMA";
        if (rebaixamento && operadorId === auditoria.operadorId) throw new Error("AUTORREBAIXAMENTO_NAO_PERMITIDO");
        if (rebaixamento && atual.ativo) {
          const total = await tx.operadorPlataforma.count({ where: { perfil: "ADMIN_PLATAFORMA", ativo: true } });
          if (total <= 1) throw new Error("ULTIMO_ADMIN_ATIVO");
        }
        const mudancas: Record<string, { de: string; para: string }> = {};
        if (atual.nome !== dados.nome) mudancas.nome = { de: atual.nome, para: dados.nome };
        if (atual.email !== dados.email) mudancas.email = { de: atual.email, para: dados.email };
        if (atual.perfil !== dados.perfil) mudancas.perfil = { de: atual.perfil, para: dados.perfil };
        if (!Object.keys(mudancas).length) return { ...atual, alterado: false };
        const operador = await tx.operadorPlataforma.update({
          where: { id: operadorId }, data: { ...dados, versaoToken: { increment: 1 } },
          select: { id: true, nome: true, email: true, perfil: true, ativo: true, atualizadoEm: true },
        });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria, acao: "OPERADOR_ATUALIZADO", alvoTipo: "OPERADOR_PLATAFORMA",
          alvoId: operador.id, mudancas,
        } });
        return { ...operador, alterado: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new Error("OPERADOR_DUPLICADO");
      throw erro;
    }
  }
}
