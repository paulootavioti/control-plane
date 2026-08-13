import { Router } from "express";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ObterResumoDashboardService } from "./ObterResumoDashboardService";

export const dashboardRoutes = Router();

dashboardRoutes.get(
  "/resumo",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (_request, response) => response.json(await new ObterResumoDashboardService(prisma).execute()),
);
