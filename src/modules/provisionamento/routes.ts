import { Router } from "express";
import { z } from "zod";

import { autenticarOperador } from "../auth/autenticarOperador";
import { prisma } from "../../shared/prisma";
import { SolicitarProvisionamento } from "./SolicitarProvisionamento";

export const provisionamentoRoutes = Router();

const solicitacaoSchema = z.object({
  assinanteId: z.string().uuid(),
  regiao: z.string().regex(/^[a-z0-9-]{2,80}$/),
  schemaVersaoDesejada: z.string().trim().min(1).max(100),
}).strict();

provisionamentoRoutes.post(
  "/solicitacoes",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const validacao = solicitacaoSchema.safeParse(request.body);
    if (!validacao.success) return response.status(400).json({ mensagem: "Solicitação inválida." });
    try {
      const resultado = await new SolicitarProvisionamento(prisma).execute(validacao.data);
      return response.status(resultado.duplicado ? 200 : 202).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Assinante não encontrado." });
      }
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "Assinante não está elegível para provisionamento." });
      }
      throw erro;
    }
  },
);
