import { PrismaClient } from "@prisma/client";

export interface FiltrosAuditoria {
  assinanteId?: string;
  operadorId?: string;
  acao?: string;
  alvoTipo?: string;
  alvoId?: string;
  inicio?: Date;
  fim?: Date;
  pagina: number;
  limite: number;
}

export class ListarAuditoriaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosAuditoria) {
    const where = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.operadorId ? { operadorId: filtros.operadorId } : {}),
      ...(filtros.acao ? { acao: filtros.acao } : {}),
      ...(filtros.alvoTipo ? { alvoTipo: filtros.alvoTipo } : {}),
      ...(filtros.alvoId ? { alvoId: filtros.alvoId } : {}),
      ...((filtros.inicio || filtros.fim) ? {
        criadoEm: {
          ...(filtros.inicio ? { gte: filtros.inicio } : {}),
          ...(filtros.fim ? { lte: filtros.fim } : {}),
        },
      } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, itens] = await this.db.$transaction([
      this.db.auditLogPlataforma.count({ where }),
      this.db.auditLogPlataforma.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        select: {
          id: true, origem: true, acao: true, alvoTipo: true, alvoId: true,
          mudancas: true, ip: true, userAgent: true, criadoEm: true,
          operador: { select: { id: true, nome: true, perfil: true } },
          assinante: { select: { id: true, nomeFantasia: true, slug: true } },
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
