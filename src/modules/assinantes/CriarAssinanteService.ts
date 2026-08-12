import { Prisma, PrismaClient, TipoContatoAssinante } from "@prisma/client";

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

  async execute(dados: DadosNovoAssinante) {
    try {
      return await this.db.assinante.create({
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
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("ASSINANTE_DUPLICADO");
      }
      throw erro;
    }
  }
}
