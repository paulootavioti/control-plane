import { PrismaClient, StatusAssinatura } from "@prisma/client";

export interface FiltrosAssinaturas {
  assinanteId?: string;
  status?: StatusAssinatura;
  planoId?: string;
  busca?: string;
  testeAteInicio?: Date;
  testeAteFim?: Date;
  encerradaInicio?: Date;
  encerradaFim?: Date;
  pagina: number;
  limite: number;
}

export class ListarAssinaturasService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosAssinaturas) {
    const where = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.planoId ? { planoVersao: { planoId: filtros.planoId } } : {}),
      ...(filtros.busca ? { assinante: { OR: [
        { nomeFantasia: { contains: filtros.busca, mode: "insensitive" as const } },
        { slug: { contains: filtros.busca, mode: "insensitive" as const } },
      ] } } : {}),
      ...((filtros.testeAteInicio || filtros.testeAteFim) ? { testeAte: {
        ...(filtros.testeAteInicio ? { gte: filtros.testeAteInicio } : {}),
        ...(filtros.testeAteFim ? { lte: filtros.testeAteFim } : {}),
      } } : {}),
      ...((filtros.encerradaInicio || filtros.encerradaFim) ? { encerradaEm: {
        ...(filtros.encerradaInicio ? { gte: filtros.encerradaInicio } : {}),
        ...(filtros.encerradaFim ? { lte: filtros.encerradaFim } : {}),
      } } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.assinatura.count({ where }),
      this.db.assinatura.findMany({
        where, skip, take: filtros.limite,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        select: {
          id: true, status: true, inicioEm: true, testeAte: true, canceladaEm: true,
          encerradaEm: true, diaVencimento: true, alunosPorBlocoNegociado: true,
          precoPorBlocoCentavosNegociado: true, blocosMinimosPorUnidadeNegociado: true,
          criadoEm: true, atualizadoEm: true,
          assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
          planoVersao: { select: {
            id: true, versao: true, alunosPorBloco: true, precoPorBlocoCentavos: true,
            blocosMinimosPorUnidade: true, moeda: true,
            plano: { select: { id: true, nome: true } },
          } },
          _count: { select: { faturas: true } },
        },
      }),
    ]);
    return {
      itens: itens.map(({ _count, ...assinatura }) => ({ ...assinatura, totalFaturas: _count.faturas })),
      paginacao: { pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) },
    };
  }
}
