import { Prisma, PrismaClient, StatusAmbienteTenant } from "@prisma/client";

export interface FiltrosAmbientesTenant {
  assinanteId?: string;
  status?: StatusAmbienteTenant;
  provider?: string;
  regiao?: string;
  schemaDesatualizado?: boolean;
  pagina: number;
  limite: number;
}

export class ListarAmbientesTenantService {
  constructor(private readonly db: PrismaClient) {}

  async execute(filtros: FiltrosAmbientesTenant) {
    const idsPorSchema = filtros.schemaDesatualizado === undefined
      ? undefined
      : await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "AmbienteTenant"
          WHERE ${filtros.schemaDesatualizado
            ? Prisma.sql`"schemaVersaoAtual" IS DISTINCT FROM "schemaVersaoDesejada"`
            : Prisma.sql`"schemaVersaoAtual" IS NOT DISTINCT FROM "schemaVersaoDesejada"`}
        `);
    const where: Prisma.AmbienteTenantWhereInput = {
      ...(filtros.assinanteId ? { assinanteId: filtros.assinanteId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.provider ? { provider: filtros.provider } : {}),
      ...(filtros.regiao ? { regiao: filtros.regiao } : {}),
      ...(idsPorSchema ? { id: { in: idsPorSchema.map(({ id }) => id) } } : {}),
    };
    const skip = (filtros.pagina - 1) * filtros.limite;
    const [total, ambientes] = await this.db.$transaction([
      this.db.ambienteTenant.count({ where }),
      this.db.ambienteTenant.findMany({
        where,
        skip,
        take: filtros.limite,
        orderBy: [{ atualizadoEm: "desc" }, { id: "desc" }],
        select: {
          id: true,
          status: true,
          provider: true,
          regiao: true,
          postgresVersion: true,
          schemaVersaoAtual: true,
          schemaVersaoDesejada: true,
          ultimaMigrationEm: true,
          ultimoHealthCheckEm: true,
          ultimoBackupVerificadoEm: true,
          ultimaRotacaoEm: true,
          criadoEm: true,
          atualizadoEm: true,
          assinante: {
            select: { id: true, nomeFantasia: true, slug: true, status: true },
          },
          eventos: {
            take: 1,
            orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
            select: {
              id: true,
              tipo: true,
              status: true,
              etapaAtual: true,
              tentativas: true,
              proximaTentativaEm: true,
              atualizadoEm: true,
            },
          },
        },
      }),
    ]);

    return {
      itens: ambientes.map(({ eventos, ...ambiente }) => {
        const ultimoEvento = eventos[0] ?? null;
        const schemaDesatualizado = ambiente.schemaVersaoAtual !== ambiente.schemaVersaoDesejada;
        return {
          ...ambiente,
          schemaDesatualizado,
          necessitaAtencao: ambiente.status === "FALHOU" || schemaDesatualizado,
          retomadaManualDisponivel:
            ultimoEvento?.status === "FALHOU" && ultimoEvento.tentativas >= 5,
          ultimoEvento,
        };
      }),
      paginacao: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }
}
