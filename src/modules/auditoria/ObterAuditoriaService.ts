import { PrismaClient } from "@prisma/client";

export class ObterAuditoriaService {
  constructor(private readonly db: PrismaClient) {}

  async execute(auditoriaId: string) {
    const auditoria = await this.db.auditLogPlataforma.findUnique({
      where: { id: auditoriaId },
      select: {
        id: true, origem: true, acao: true, alvoTipo: true, alvoId: true,
        mudancas: true, ip: true, userAgent: true, criadoEm: true,
        operador: { select: { id: true, nome: true, perfil: true, ativo: true } },
        assinante: { select: { id: true, nomeFantasia: true, slug: true, status: true } },
      },
    });
    if (!auditoria) throw new Error("AUDITORIA_NAO_ENCONTRADA");
    return auditoria;
  }
}
