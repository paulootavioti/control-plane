import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarPlanosService } from "./ListarPlanosService";

export const planosRoutes = Router();

const filtrosSchema = z.object({
  incluirHistorico: z.enum(["true", "false"]).transform((valor) => valor === "true").default(false),
}).strict();

planosRoutes.get("/", autenticarOperador(), async (request, response) => {
  const validacao = filtrosSchema.safeParse(request.query);
  if (!validacao.success) return response.status(400).json({ mensagem: "Filtros inválidos." });

  const planos = await new ListarPlanosService(prisma).execute(validacao.data.incluirHistorico);
  return response.json({ itens: planos });
});
