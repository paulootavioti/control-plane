import {
  PrismaClient,
  StatusAmbienteTenant,
  StatusAssinante,
  StatusFatura,
  StatusLicencaUnidade,
} from "@prisma/client";

function contagensPorStatus<T extends string>(status: readonly T[], grupos: Array<{ status: T; _count: { _all: number } }>) {
  const contagem = new Map(grupos.map((grupo) => [grupo.status, grupo._count._all]));
  return Object.fromEntries(status.map((item) => [item, contagem.get(item) ?? 0])) as Record<T, number>;
}

export class ObterResumoDashboardService {
  constructor(private readonly db: PrismaClient) {}

  async execute() {
    const [assinantes, ambientes, licencas, faturas] = await Promise.all([
      this.db.assinante.groupBy({
        by: ["status"] as ["status"], orderBy: { status: "asc" }, _count: { _all: true },
      }),
      this.db.ambienteTenant.groupBy({
        by: ["status"] as ["status"], orderBy: { status: "asc" }, _count: { _all: true },
      }),
      this.db.licencaUnidade.groupBy({
        by: ["status"] as ["status"], orderBy: { status: "asc" }, _count: { _all: true },
      }),
      this.db.fatura.groupBy({
        by: ["status"] as ["status"],
        orderBy: { status: "asc" },
        _count: { _all: true },
        _sum: { totalCentavos: true },
      }),
    ]);

    const statusAssinantes = Object.values(StatusAssinante);
    const statusAmbientes = Object.values(StatusAmbienteTenant);
    const statusLicencas = Object.values(StatusLicencaUnidade);
    const statusFaturas = Object.values(StatusFatura);
    const faturaPorStatus = new Map(faturas.map((grupo) => [grupo.status, grupo]));

    return {
      assinantes: contagensPorStatus(statusAssinantes, assinantes),
      ambientes: contagensPorStatus(statusAmbientes, ambientes),
      licencas: contagensPorStatus(statusLicencas, licencas),
      faturas: Object.fromEntries(statusFaturas.map((status) => {
        const grupo = faturaPorStatus.get(status);
        return [status, {
          quantidade: grupo?._count._all ?? 0,
          totalCentavos: grupo?._sum.totalCentavos ?? 0,
        }];
      })) as Record<StatusFatura, { quantidade: number; totalCentavos: number }>,
    };
  }
}
