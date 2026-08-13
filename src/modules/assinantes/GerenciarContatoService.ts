import { PrismaClient, TipoContatoAssinante } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface AlteracoesContato {
  nome?: string;
  email?: string | null;
  telefone?: string | null;
  tipo?: TipoContatoAssinante;
  principal?: boolean;
}

const selecaoContato = {
  id: true,
  assinanteId: true,
  nome: true,
  email: true,
  telefone: true,
  tipo: true,
  principal: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

export class GerenciarContatoService {
  constructor(private readonly db: PrismaClient) {}

  async atualizar(
    assinanteId: string,
    contatoId: string,
    dados: AlteracoesContato,
    auditoria: ContextoAuditoria,
  ) {
    return this.db.$transaction(async (tx) => {
      const atual = await tx.contatoAssinante.findFirst({
        where: { id: contatoId, assinanteId },
        select: selecaoContato,
      });
      if (!atual) throw new Error("CONTATO_NAO_ENCONTRADO");

      const camposAlterados = (Object.keys(dados) as Array<keyof AlteracoesContato>)
        .filter((campo) => dados[campo] !== atual[campo]);
      if (camposAlterados.length === 0) return { contato: atual, alterado: false };

      if (dados.principal === true && !atual.principal) {
        await tx.contatoAssinante.updateMany({
          where: { assinanteId, principal: true, id: { not: contatoId } },
          data: { principal: false },
        });
      }
      const contato = await tx.contatoAssinante.update({
        where: { id: contatoId },
        data: dados,
        select: selecaoContato,
      });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId,
        acao: "CONTATO_ATUALIZADO",
        alvoTipo: "CONTATO_ASSINANTE",
        alvoId: contatoId,
        mudancas: {
          camposAlterados,
          principalAnterior: atual.principal,
          principal: contato.principal,
        },
      } });
      return { contato, alterado: true };
    });
  }

  async remover(assinanteId: string, contatoId: string, auditoria: ContextoAuditoria) {
    return this.db.$transaction(async (tx) => {
      const contato = await tx.contatoAssinante.findFirst({
        where: { id: contatoId, assinanteId },
        select: { id: true, tipo: true, principal: true },
      });
      if (!contato) throw new Error("CONTATO_NAO_ENCONTRADO");

      await tx.contatoAssinante.delete({ where: { id: contato.id } });
      await tx.auditLogPlataforma.create({ data: {
        ...auditoria,
        assinanteId,
        acao: "CONTATO_REMOVIDO",
        alvoTipo: "CONTATO_ASSINANTE",
        alvoId: contato.id,
        mudancas: { tipo: contato.tipo, eraPrincipal: contato.principal },
      } });
      return { removido: true };
    });
  }
}
