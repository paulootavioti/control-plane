import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ObterResumoDashboardService } from "./ObterResumoDashboardService";
import { ObterResumoFinanceiroService } from "./ObterResumoFinanceiroService";
import { competenciaSchema } from "../comercial/regrasComerciais";
import { ObterSaudeFrotaService } from "./ObterSaudeFrotaService";

export const dashboardRoutes = Router();

dashboardRoutes.get("/frota", autenticarOperador(["SUPORTE", "ADMIN_PLATAFORMA"]), async (_request, response) =>
  response.json(await new ObterSaudeFrotaService(prisma).execute()),
);

dashboardRoutes.get(
  "/resumo",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (_request, response) => response.json(await new ObterResumoDashboardService(prisma).execute()),
);

const filtrosFinanceirosSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  competencia: competenciaSchema.optional(),
  vencimentoInicio: z.coerce.date().optional(),
  vencimentoFim: z.coerce.date().optional(),
}).strict().refine(
  ({ vencimentoInicio, vencimentoFim }) => !vencimentoInicio || !vencimentoFim || vencimentoInicio <= vencimentoFim,
  { message: "Período de vencimento inválido.", path: ["vencimentoFim"] },
);

dashboardRoutes.get(
  "/financeiro",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosFinanceirosSchema.safeParse(request.query);
    if (!filtros.success) return response.status(400).json({ mensagem: "Filtros financeiros inválidos." });
    return response.json(await new ObterResumoFinanceiroService(prisma).execute(filtros.data));
  },
);
