import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarDiretorio } from "./autenticarDiretorio";
import { ResolverTenantService } from "./ResolverTenantService";

export const diretorioRoutes = Router({ mergeParams: true });
const slugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
const produtoSchema = z.enum(["sysbelt", "mecanix", "psyche"]);

diretorioRoutes.get("/:slug", autenticarDiretorio, async (request, response) => {
  const slug = slugSchema.safeParse(request.params.slug);
  const produto = produtoSchema.safeParse(request.params.produto ?? "sysbelt");
  if (!slug.success || !produto.success) return response.status(404).json({ codigo: "TENANT_NAO_ENCONTRADO", mensagem: "Tenant não encontrado." });
  try {
    return response.json(await new ResolverTenantService(prisma).execute(produto.data, slug.data));
  } catch (erro) {
    if (erro instanceof Error && erro.message === "TENANT_NAO_ENCONTRADO") {
      return response.status(404).json({ codigo: "TENANT_NAO_ENCONTRADO", mensagem: "Tenant não encontrado." });
    }
    throw erro;
  }
});
