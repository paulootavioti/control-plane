import { Prisma, PrismaClient } from "@prisma/client";

import { ContagemContratoV1 } from "./contagemContrato";

export class ReceberSnapshotContagem {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinanteId: string, payload: ContagemContratoV1): Promise<{ id: string; duplicado: boolean }> {
    const existente = await this.db.snapshotContagem.findUnique({
      where: { assinanteId_eventoExternoId: { assinanteId, eventoExternoId: payload.eventoId } },
      select: { id: true },
    });
    if (existente) return { id: existente.id, duplicado: true };

    try {
      return await this.db.$transaction(async (tx) => {
      const licencas = await Promise.all(payload.unidades.map((unidade) => tx.licencaUnidade.upsert({
        where: { assinanteId_tenantUnidadeId: { assinanteId, tenantUnidadeId: unidade.unidadeId } },
        create: {
          assinanteId,
          tenantUnidadeId: unidade.unidadeId,
          nomeExibicao: unidade.nomeExibicao,
          status: unidade.status,
          inicioCobrancaEm: new Date(payload.dataCorte),
          encerramentoCobrancaEm: unidade.status === "ENCERRADA" ? new Date(payload.dataCorte) : null,
          ultimaSincronizacaoEm: new Date(),
        },
        update: {
          nomeExibicao: unidade.nomeExibicao,
          status: unidade.status,
          encerramentoCobrancaEm: unidade.status === "ENCERRADA" ? new Date(payload.dataCorte) : null,
          ultimaSincronizacaoEm: new Date(),
        },
        select: { id: true, tenantUnidadeId: true },
      })));
      const licencaPorUnidade = new Map(licencas.map((licenca) => [licenca.tenantUnidadeId, licenca.id]));

      const snapshot = await tx.snapshotContagem.create({
        data: {
          assinanteId,
          eventoExternoId: payload.eventoId,
          versaoContrato: payload.versao,
          dataCorte: new Date(payload.dataCorte),
          itens: {
            create: payload.unidades.map((unidade) => ({
              assinanteId,
              licencaUnidadeId: licencaPorUnidade.get(unidade.unidadeId)!,
              alunosAtivos: unidade.alunosAtivos,
            })),
          },
        },
        select: { id: true },
      });
      return { id: snapshot.id, duplicado: false };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        const concorrente = await this.db.snapshotContagem.findUnique({
          where: { assinanteId_eventoExternoId: { assinanteId, eventoExternoId: payload.eventoId } },
          select: { id: true },
        });
        if (concorrente) return { id: concorrente.id, duplicado: true };
      }
      throw erro;
    }
  }
}
