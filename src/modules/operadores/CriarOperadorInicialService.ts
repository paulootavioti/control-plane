import { PerfilOperador, Prisma, PrismaClient } from "@prisma/client";

interface DadosOperadorInicial {
  nome: string;
  email: string;
  senhaHash: string;
}

export class CriarOperadorInicialService {
  constructor(private readonly db: PrismaClient) {}

  async execute(dados: DadosOperadorInicial) {
    return this.db.$transaction(async (tx) => {
      const existente = await tx.operadorPlataforma.findUnique({
        where: { email: dados.email },
        select: { id: true, ativo: true, perfil: true },
      });
      if (existente) {
        if (existente.ativo && existente.perfil === PerfilOperador.ADMIN_PLATAFORMA) {
          return { criado: false, operadorId: existente.id };
        }
        throw new Error("OPERADOR_INICIAL_EMAIL_CONFLITANTE");
      }

      const administradores = await tx.operadorPlataforma.count({
        where: { perfil: PerfilOperador.ADMIN_PLATAFORMA, ativo: true },
      });
      if (administradores > 0) throw new Error("OPERADOR_INICIAL_JA_CONFIGURADO");

      const operador = await tx.operadorPlataforma.create({
        data: { ...dados, perfil: PerfilOperador.ADMIN_PLATAFORMA },
        select: { id: true },
      });
      return { criado: true, operadorId: operador.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
