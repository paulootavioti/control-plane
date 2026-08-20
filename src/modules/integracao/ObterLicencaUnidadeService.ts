import { PrismaClient } from "@prisma/client";

export class ObterLicencaUnidadeService {
  constructor(private readonly db: PrismaClient) {}

  async execute(licencaId: string) {
    const licenca = await this.db.licencaUnidade.findUnique({
      where: { id: licencaId },
      select: {
        id: true,
        tenantUnidadeId: true,
        nomeExibicao: true,
        status: true,
        inicioCobrancaEm: true,
        encerramentoCobrancaEm: true,
        ultimaSincronizacaoEm: true,
        criadoEm: true,
        atualizadoEm: true,
        assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
        contagens: {
          take: 12,
          orderBy: [
            { snapshot: { dataCorte: "desc" } },
            { snapshotId: "desc" },
          ],
          select: {
            alunosAtivos: true,
            snapshot: {
              select: {
                id: true,
                eventoExternoId: true,
                versaoContrato: true,
                dataCorte: true,
                recebidoEm: true,
              },
            },
          },
        },
      },
    });
    if (!licenca) throw new Error("LICENCA_NAO_ENCONTRADA");

    return licenca;
  }
}
