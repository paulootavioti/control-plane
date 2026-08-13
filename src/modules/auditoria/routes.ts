import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarAuditoriaService } from "./ListarAuditoriaService";
import { ObterAuditoriaService } from "./ObterAuditoriaService";

export const auditoriaRoutes = Router();

const filtrosSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  operadorId: z.string().uuid().optional(),
  acao: z.string().trim().regex(/^[A-Z0-9_]{2,100}$/).optional(),
  alvoTipo: z.string().trim().regex(/^[A-Z0-9_]{2,60}$/).optional(),
  alvoId: z.string().trim().min(1).max(200).optional(),
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(({ inicio, fim }) => !inicio || !fim || inicio <= fim, {
  message: "Período inválido.", path: ["fim"],
});

auditoriaRoutes.get(
  "/",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosSchema.safeParse(request.query);
    if (!filtros.success) return response.status(400).json({ mensagem: "Filtros de auditoria inválidos." });
    return response.json(await new ListarAuditoriaService(prisma).execute(filtros.data));
  },
);

auditoriaRoutes.get(
  "/:auditoriaId",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const auditoriaId = z.string().uuid().safeParse(request.params.auditoriaId);
    if (!auditoriaId.success) return response.status(400).json({ mensagem: "Auditoria inválida." });
    try {
      return response.json(await new ObterAuditoriaService(prisma).execute(auditoriaId.data));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "AUDITORIA_NAO_ENCONTRADA") {
        return response.status(404).json({ mensagem: "Auditoria não encontrada." });
      }
      throw erro;
    }
  },
);
