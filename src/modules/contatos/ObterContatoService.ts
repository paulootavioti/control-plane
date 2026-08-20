import { PrismaClient } from "@prisma/client";

export class ObterContatoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(contatoId: string) {
    const contato = await this.db.contatoAssinante.findUnique({
      where: { id: contatoId },
      select: {
        id: true, nome: true, email: true, telefone: true, tipo: true,
        principal: true, criadoEm: true, atualizadoEm: true,
        assinante: {
          select: {
            id: true, nomeFantasia: true, slug: true, status: true,
            assinaturas: {
              where: { encerradaEm: null }, take: 1, orderBy: { criadoEm: "desc" },
              select: {
                id: true, status: true, testeAte: true,
                planoVersao: { select: { versao: true, plano: { select: { id: true, nome: true } } } },
              },
            },
          },
        },
      },
    });
    if (!contato) throw new Error("CONTATO_NAO_ENCONTRADO");
    const { assinaturas, ...assinante } = contato.assinante;
    return { ...contato, assinante: { ...assinante, assinaturaCorrente: assinaturas[0] ?? null } };
  }
}
