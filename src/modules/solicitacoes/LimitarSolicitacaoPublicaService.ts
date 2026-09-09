import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

export class LimitarSolicitacaoPublicaService {
  constructor(private readonly db: PrismaClient) {}

  async consumir(ip: string, produtoId: string, agora = new Date()) {
    const janelaMs = 15 * 60 * 1000;
    const janela = new Date(Math.floor(agora.getTime() / janelaMs) * janelaMs);
    const ipHash = createHash("sha256").update(ip).digest("hex");
    const limites = [{ chave: `ip:${ipHash}`, limite: 10 }, { chave: `produto:${produtoId}`, limite: 100 }];
    const quantidades = await this.db.$transaction(limites.map(({ chave }) => this.db.$queryRaw<Array<{ quantidade: number }>>(Prisma.sql`
      INSERT INTO "LimiteSolicitacaoPublica" ("chave", "janela", "quantidade", "atualizadoEm")
      VALUES (${chave}, ${janela}, 1, ${agora})
      ON CONFLICT ("chave") DO UPDATE SET
        "quantidade" = CASE WHEN "LimiteSolicitacaoPublica"."janela" = ${janela}
          THEN "LimiteSolicitacaoPublica"."quantidade" + 1 ELSE 1 END,
        "janela" = ${janela}, "atualizadoEm" = ${agora}
      RETURNING "quantidade"
    `)));
    return limites.every(({ limite }, indice) => (quantidades[indice][0]?.quantidade ?? limite + 1) <= limite);
  }
}
