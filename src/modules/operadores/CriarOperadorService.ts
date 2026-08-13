import { PerfilOperador, Prisma, PrismaClient } from "@prisma/client";

import { ContextoAuditoria } from "../auditoria/contextoAuditoria";
import { criarSenhaHash } from "../auth/regrasAuth";

export interface DadosNovoOperador {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilOperador;
}

export class CriarOperadorService {
  constructor(private readonly db: PrismaClient) {}

  async execute(dados: DadosNovoOperador, auditoria: ContextoAuditoria) {
    const senhaHash = await criarSenhaHash(dados.senha);

    try {
      return await this.db.$transaction(async (tx) => {
        const operador = await tx.operadorPlataforma.create({
          data: {
            nome: dados.nome,
            email: dados.email,
            senhaHash,
            perfil: dados.perfil,
            ativo: true,
          },
          select: {
            id: true,
            nome: true,
            email: true,
            perfil: true,
            ativo: true,
            criadoEm: true,
          },
        });

        await tx.auditLogPlataforma.create({
          data: {
            ...auditoria,
            acao: "OPERADOR_CRIADO",
            alvoTipo: "OPERADOR_PLATAFORMA",
            alvoId: operador.id,
            mudancas: { perfil: operador.perfil, ativo: operador.ativo },
          },
        });

        return operador;
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new Error("OPERADOR_DUPLICADO");
      }
      throw erro;
    }
  }
}
