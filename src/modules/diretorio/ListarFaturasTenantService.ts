import type { PrismaClient } from "@prisma/client";

export class ListarFaturasTenantService {
  constructor(private readonly db: PrismaClient) {}

  async execute(produtoCodigo: string, slug: string) {
    const tenant = await this.db.tenantProduto.findUnique({
      where: { produtoCodigo_slug: { produtoCodigo, slug } }, select: { assinanteId: true },
    });
    if (!tenant) throw new Error("TENANT_NAO_ENCONTRADO");
    const faturas = await this.db.fatura.findMany({
      where: { assinanteId: tenant.assinanteId }, take: 12,
      orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
      select: {
        id: true, competencia: true, vencimentoEm: true, status: true,
        totalCentavos: true, pagaEm: true,
        itens: { select: {
          tenantUnidadeId: true, nomeUnidade: true, alunosAtivos: true,
          alunosPorBloco: true, blocosCobrados: true,
          precoPorBlocoCentavos: true, valorCentavos: true,
        } },
      },
    });
    return faturas.map((fatura) => ({
      id: fatura.id,
      competencia: fatura.competencia,
      vencimento: fatura.vencimentoEm,
      status: fatura.status,
      alunosContados: fatura.itens.reduce((total, item) => total + item.alunosAtivos, 0),
      alunosPorBloco: fatura.itens[0]?.alunosPorBloco ?? 0,
      blocos: fatura.itens.reduce((total, item) => total + item.blocosCobrados, 0),
      precoPorBlocoCentavos: fatura.itens[0]?.precoPorBlocoCentavos ?? 0,
      valorCentavos: fatura.totalCentavos,
      pagaEm: fatura.pagaEm,
      detalhamentoUnidades: fatura.itens.map((item) => ({
        unidadeId: item.tenantUnidadeId, nomeUnidade: item.nomeUnidade,
        alunosContados: item.alunosAtivos, alunosPorBloco: item.alunosPorBloco,
        blocos: item.blocosCobrados, precoPorBlocoCentavos: item.precoPorBlocoCentavos,
        valorCentavos: item.valorCentavos,
      })),
    }));
  }
}
