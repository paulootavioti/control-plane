import { Prisma, PrismaClient, TipoContatoAssinante } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface DadosNovoContatoAssinante {
  nome: string;
  email?: string;
  telefone?: string;
  tipo: TipoContatoAssinante;
  principal: boolean;
}

export class CriarContatoAssinanteService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, dados: DadosNovoContatoAssinante, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const assinante = await tx.assinante.findUnique({
          where: { id: assinanteId },
          select: { id: true },
        });
        if (!assinante) throw new Error("ASSINANTE_NAO_ENCONTRADO");

        if (dados.principal) {
          await tx.contatoAssinante.updateMany({
            where: { assinanteId, principal: true },
            data: { principal: false },
          });
        }

        const contato = await tx.contatoAssinante.create({
          data: {
            assinanteId,
            nome: dados.nome,
            email: dados.email ?? null,
            telefone: dados.telefone ?? null,
            tipo: dados.tipo,
            principal: dados.principal,
          },
          select: {
            id: true,
            assinanteId: true,
            nome: true,
            email: true,
            telefone: true,
            tipo: true,
            principal: true,
            criadoEm: true,
          },
        });

        await tx.auditLogPlataforma.create({
          data: {
            ...auditoria,
            assinanteId,
            acao: "ASSINANTE_CONTATO_CRIADO",
            alvoTipo: "CONTATO_ASSINANTE",
            alvoId: contato.id,
            mudancas: { tipo: contato.tipo, principal: contato.principal },
          },
        });
        return contato;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(erro.code)) {
        throw new Error("CONTATO_PRINCIPAL_CONCORRENTE");
      }
      throw erro;
    }
  }
}
