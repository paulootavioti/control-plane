import { PerfilOperador, PrismaClient } from "@prisma/client";

export interface FiltrosOperadores {
  busca?: string;
  perfil?: PerfilOperador;
  ativo?: boolean;
  pagina: number;
  limite: number;
}

export class ListarOperadoresService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosOperadores) {
    const where = {
      ...(filtros.perfil ? { perfil: filtros.perfil } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
      ...(filtros.busca ? {
        OR: [
          { nome: { contains: filtros.busca, mode: "insensitive" as const } },
          { email: { contains: filtros.busca, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.operadorPlataforma.count({ where }),
      this.db.operadorPlataforma.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          ativo: true,
          ultimoLoginEm: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      }),
    ]);

    return {
      itens,
      paginacao: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }
}
