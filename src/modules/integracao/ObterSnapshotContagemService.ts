import { PrismaClient } from "@prisma/client";

export class ObterSnapshotContagemService {
  constructor(private readonly db: PrismaClient) {}

  async execute(snapshotId: string) {
    const snapshot = await this.db.snapshotContagem.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        eventoExternoId: true,
        versaoContrato: true,
        dataCorte: true,
        recebidoEm: true,
        assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
        itens: {
          orderBy: [{ licenca: { nomeExibicao: "asc" } }, { id: "asc" }],
          select: {
            alunosAtivos: true,
            licenca: { select: {
              id: true,
              tenantUnidadeId: true,
              nomeExibicao: true,
              status: true,
              inicioCobrancaEm: true,
              encerramentoCobrancaEm: true,
            } },
          },
        },
      },
    });
    if (!snapshot) throw new Error("SNAPSHOT_NAO_ENCONTRADO");

    const itens = snapshot.itens.map(({ licenca, alunosAtivos }) => ({
      licencaId: licenca.id,
      unidadeId: licenca.tenantUnidadeId,
      unidadeNome: licenca.nomeExibicao,
      statusLicenca: licenca.status,
      inicioCobrancaEm: licenca.inicioCobrancaEm,
      encerramentoCobrancaEm: licenca.encerramentoCobrancaEm,
      alunosAtivos,
    }));
    return {
      ...snapshot,
      itens,
      totalUnidades: itens.length,
      totalAlunosAtivos: itens.reduce((total, item) => total + item.alunosAtivos, 0),
    };
  }
}
