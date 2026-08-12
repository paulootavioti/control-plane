import { Router } from "express";
import { StatusAssinante } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarAssinantesService } from "./ListarAssinantesService";
import { ObterAssinanteService } from "./ObterAssinanteService";

export const assinantesRoutes = Router();

const filtrosSchema = z.object({
  busca: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(StatusAssinante).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

assinantesRoutes.get("/", autenticarOperador(), async (request, response) => {
  const validacao = filtrosSchema.safeParse(request.query);
  if (!validacao.success) return response.status(400).json({ mensagem: "Filtros inválidos." });

  const resultado = await new ListarAssinantesService(prisma).execute(validacao.data);
  return response.json(resultado);
});

assinantesRoutes.get("/:assinanteId", autenticarOperador(), async (request, response) => {
  const assinanteId = z.string().uuid().safeParse(request.params.assinanteId);
  if (!assinanteId.success) return response.status(400).json({ mensagem: "Assinante inválido." });

  try {
    const resultado = await new ObterAssinanteService(prisma).execute(assinanteId.data);
    return response.json(resultado);
  } catch (erro) {
    if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") {
      return response.status(404).json({ mensagem: "Assinante não encontrado." });
    }
    throw erro;
  }
});
