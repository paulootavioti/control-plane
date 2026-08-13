import { StatusAssinatura } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarAssinaturasService } from "./ListarAssinaturasService";

export const assinaturasRoutes = Router();
const filtrosSchema = z.object({
  assinanteId: z.string().uuid().optional(), status: z.nativeEnum(StatusAssinatura).optional(),
  planoId: z.string().uuid().optional(), busca: z.string().trim().min(1).max(120).optional(),
  testeAteInicio: z.coerce.date().optional(), testeAteFim: z.coerce.date().optional(),
  encerradaInicio: z.coerce.date().optional(), encerradaFim: z.coerce.date().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict()
  .refine(({ testeAteInicio, testeAteFim }) => !testeAteInicio || !testeAteFim || testeAteInicio <= testeAteFim,
    { message: "Período de teste inválido.", path: ["testeAteFim"] })
  .refine(({ encerradaInicio, encerradaFim }) => !encerradaInicio || !encerradaFim || encerradaInicio <= encerradaFim,
    { message: "Período de encerramento inválido.", path: ["encerradaFim"] });

assinaturasRoutes.get("/", autenticarOperador(["OPERADOR", "FINANCEIRO", "SUPORTE", "ADMIN_PLATAFORMA"]), async (request, response) => {
  const filtros = filtrosSchema.safeParse(request.query);
  if (!filtros.success) return response.status(400).json({ mensagem: "Filtros de assinaturas inválidos." });
  return response.json(await new ListarAssinaturasService(prisma).execute(filtros.data));
});
