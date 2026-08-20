import { PrismaClient } from "@prisma/client";

export class ObterOperadorService {
  constructor(private readonly db: PrismaClient) {}

  async execute(operadorId: string) {
    const operador = await this.db.operadorPlataforma.findUnique({
      where: { id: operadorId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        ultimoLoginEm: true,
        criadoEm: true,
        atualizadoEm: true,
        auditorias: {
          take: 20,
          orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
          select: {
            id: true,
            acao: true,
            alvoTipo: true,
            alvoId: true,
            origem: true,
            criadoEm: true,
          },
        },
        _count: { select: { auditorias: true } },
      },
    });
    if (!operador) throw new Error("OPERADOR_NAO_ENCONTRADO");
    const { _count, ...detalhe } = operador;
    return { ...detalhe, totalAcoesAuditadas: _count.auditorias };
  }
}
