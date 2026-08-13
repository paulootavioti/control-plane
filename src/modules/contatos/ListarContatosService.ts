import { PrismaClient, TipoContatoAssinante } from "@prisma/client";

export interface FiltrosContatos {
  assinanteId?: string;
  tipo?: TipoContatoAssinante;
  principal?: boolean;
  busca?: string;
  pagina: number;
  limite: number;
}

export class ListarContatosService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosContatos) {
    const where = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.principal !== undefined ? { principal: filtros.principal } : {}),
      ...(filtros.busca ? { OR: [
        { nome: { contains: filtros.busca, mode: "insensitive" as const } },
        { email: { contains: filtros.busca, mode: "insensitive" as const } },
        { telefone: { contains: filtros.busca } },
      ] } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.contatoAssinante.count({ where }),
      this.db.contatoAssinante.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ principal: "desc" }, { nome: "asc" }, { id: "asc" }],
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          tipo: true,
          principal: true,
          criadoEm: true,
          atualizadoEm: true,
          assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
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
