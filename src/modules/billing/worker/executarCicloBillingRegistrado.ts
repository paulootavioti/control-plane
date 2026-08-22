import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../shared/prisma";
import type { ProvedorPagamento } from "../providers/ProvedorPagamento";
import { executarCicloBilling } from "./executarCicloBilling";

function sanitizarErro(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "ERRO_DESCONHECIDO";
  return mensagem.replace(/https?:\/\/\S+/gi, "[url]").replace(/[\w.+-]+@[\w.-]+/gi, "[email]").slice(0, 300);
}

export async function executarCicloBillingRegistrado(
  db: PrismaClient = prisma,
  provedor?: ProvedorPagamento,
  limite = 10,
) {
  const execucao = await db.execucaoWorkerBilling.create({ data: { limite }, select: { id: true } });
  try {
    const resultado = await executarCicloBilling(db, provedor, limite);
    await db.execucaoWorkerBilling.update({
      where: { id: execucao.id },
      data: {
        ...resultado,
        status: resultado.falhas > 0 ? "PARCIAL" : "SUCESSO",
        concluidoEm: new Date(),
      },
    });
    return resultado;
  } catch (erro) {
    await db.execucaoWorkerBilling.update({
      where: { id: execucao.id },
      data: { status: "FALHOU", falhas: 1, erroSanitizado: sanitizarErro(erro), concluidoEm: new Date() },
    });
    throw erro;
  }
}
