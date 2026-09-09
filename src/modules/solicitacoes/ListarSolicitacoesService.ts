import { IntencaoSolicitacaoAssinatura, PrismaClient, StatusSolicitacaoAssinatura } from "@prisma/client";

export interface FiltrosSolicitacoes { produtoId?: string; status?: StatusSolicitacaoAssinatura;
  intencao?: IntencaoSolicitacaoAssinatura; inicio?: Date; fim?: Date; pagina: number; limite: number }

export class ListarSolicitacoesService {
  constructor(private readonly db: PrismaClient) {}
  async execute(f: FiltrosSolicitacoes) {
    const where = { ...(f.produtoId ? { produtoId: f.produtoId } : {}), ...(f.status ? { status: f.status } : {}),
      ...(f.intencao ? { intencao: f.intencao } : {}), ...((f.inicio || f.fim) ? { criadoEm: { gte: f.inicio, lte: f.fim } } : {}) };
    const [total, itens] = await this.db.$transaction([
      this.db.solicitacaoAssinatura.count({ where }),
      this.db.solicitacaoAssinatura.findMany({ where, skip: (f.pagina - 1) * f.limite, take: f.limite,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, produtoId: true, intencao: true,
          nomeOrganizacao: true, documento: true, responsavel: true, email: true, telefone: true, origem: true,
          status: true, motivo: true, assinanteId: true, criadoEm: true, decididoEm: true,
          produto: { select: { codigo: true, nome: true } } } }),
    ]);
    return { itens, paginacao: { pagina: f.pagina, limite: f.limite, total, totalPaginas: Math.ceil(total / f.limite) } };
  }
}
