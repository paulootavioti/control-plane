import { PrismaClient, StatusAssinante } from "@prisma/client";

export interface FiltrosAssinantes {
  busca?: string;
  status?: StatusAssinante;
  pagina: number;
  limite: number;
}

export class ListarAssinantesService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosAssinantes) {
    const where = {
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.busca ? {
        OR: [
          { nomeFantasia: { contains: filtros.busca, mode: "insensitive" as const } },
          { documento: { contains: filtros.busca } },
          { emailCobranca: { contains: filtros.busca, mode: "insensitive" as const } },
          { slug: { contains: filtros.busca, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.assinante.count({ where }),
      this.db.assinante.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ nomeFantasia: "asc" }, { id: "asc" }],
        select: {
          id: true, nomeFantasia: true, documento: true, emailCobranca: true,
          telefone: true, slug: true, status: true, criadoEm: true,
          ambiente: { select: { id: true, status: true, schemaVersaoAtual: true } },
          assinaturas: {
            where: { encerradaEm: null }, take: 1, orderBy: { criadoEm: "desc" },
            select: {
              id: true, status: true, testeAte: true, diaVencimento: true,
              planoVersao: { select: { versao: true, plano: { select: { id: true, nome: true } } } },
            },
          },
          _count: { select: { licencas: true } },
        },
      }),
    ]);

    return {
      itens: itens.map(({ assinaturas, _count, ...assinante }) => ({
        ...assinante,
        assinatura: assinaturas[0] ?? null,
        totalLicencas: _count.licencas,
      })),
      paginacao: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }
}
