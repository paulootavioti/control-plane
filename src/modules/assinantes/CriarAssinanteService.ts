import { Prisma, PrismaClient, TipoContatoAssinante } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";

export interface DadosNovoAssinante {
  nomeFantasia: string;
  razaoSocial?: string;
  documento: string;
  emailCobranca: string;
  telefone?: string;
  slug: string;
  contatos: Array<{
    nome: string;
    email?: string;
    telefone?: string;
    tipo: TipoContatoAssinante;
    principal: boolean;
  }>;
}

export class CriarAssinanteService {
  constructor(private readonly db: PrismaClient) {}

  async execute(dados: DadosNovoAssinante, auditoria: ContextoAuditoria) {
    try {
      return await this.db.$transaction(async (tx) => {
        const assinante = await tx.assinante.create({
        data: {
          nomeFantasia: dados.nomeFantasia,
          razaoSocial: dados.razaoSocial ?? null,
          documento: dados.documento,
          emailCobranca: dados.emailCobranca,
          telefone: dados.telefone ?? null,
          slug: dados.slug,
          status: "PROSPECT",
          contatos: dados.contatos.length ? { create: dados.contatos } : undefined,
        },
        select: {
          id: true, nomeFantasia: true, razaoSocial: true, documento: true,
          emailCobranca: true, telefone: true, slug: true, status: true, criadoEm: true,
          contatos: { select: { id: true, nome: true, email: true, telefone: true, tipo: true, principal: true } },
        },
        });
        await tx.auditLogPlataforma.create({ data: {
          ...auditoria,
          assinanteId: assinante.id,
          acao: "ASSINANTE_CRIADO",
          alvoTipo: "ASSINANTE",
          alvoId: assinante.id,
          mudancas: { status: "PROSPECT", slug: assinante.slug, totalContatos: dados.contatos.length },
        } });
        return assinante;
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("ASSINANTE_DUPLICADO");
      }
      throw erro;
    }
  }
}
