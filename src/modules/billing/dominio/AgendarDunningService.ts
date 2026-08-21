import type { PrismaClient } from "@prisma/client";
import { REGUA_DUNNING_PADRAO } from "./reguaDunning";

const DIA_EM_MS = 24 * 60 * 60 * 1000;

export class AgendarDunningService {
  constructor(private readonly db: PrismaClient) {}

  async execute(assinaturaId: string, primeiraFalhaEm = new Date()) {
    return this.db.$transaction(async (tx) => {
      await tx.assinatura.update({
        where: { id: assinaturaId },
        data: { status: "INADIMPLENTE", primeiraFalhaPagamentoEm: primeiraFalhaEm },
      });
      await Promise.all(REGUA_DUNNING_PADRAO.map((passo) => tx.tentativaDunning.upsert({
        where: { assinaturaId_diaRegua: { assinaturaId, diaRegua: passo.dia } },
        create: {
          assinaturaId,
          diaRegua: passo.dia,
          acao: passo.acao,
          agendadaPara: new Date(primeiraFalhaEm.getTime() + passo.dia * DIA_EM_MS),
        },
        update: {},
      })));
      return { assinaturaId, passos: REGUA_DUNNING_PADRAO.length };
    });
  }
}
