import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarDiretorio } from "./autenticarDiretorio";
import { ResolverTenantService } from "./ResolverTenantService";

export const diretorioRoutes = Router();
const slugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);

diretorioRoutes.get("/:slug", autenticarDiretorio, async (request, response) => {
  const slug = slugSchema.safeParse(request.params.slug);
  if (!slug.success) return response.status(404).json({ mensagem: "Tenant não encontrado." });
  try {
    return response.json(await new ResolverTenantService(prisma).execute(slug.data));
  } catch (erro) {
    if (erro instanceof Error && erro.message === "TENANT_NAO_ENCONTRADO") {
      return response.status(404).json({ mensagem: "Tenant não encontrado." });
    }
    throw erro;
  }
});
