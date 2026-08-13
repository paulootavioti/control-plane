import { TipoContatoAssinante } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarContatosService } from "./ListarContatosService";
import { ObterContatoService } from "./ObterContatoService";

export const contatosRoutes = Router();

const filtrosSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  tipo: z.nativeEnum(TipoContatoAssinante).optional(),
  principal: z.enum(["true", "false"]).transform((valor) => valor === "true").optional(),
  busca: z.string().trim().min(1).max(120).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

contatosRoutes.get(
  "/",
  autenticarOperador(["OPERADOR", "FINANCEIRO", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosSchema.safeParse(request.query);
    if (!filtros.success) return response.status(400).json({ mensagem: "Filtros de contatos inválidos." });
    return response.json(await new ListarContatosService(prisma).execute(filtros.data));
  },
);

contatosRoutes.get(
  "/:contatoId",
  autenticarOperador(["OPERADOR", "FINANCEIRO", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const contatoId = z.string().uuid().safeParse(request.params.contatoId);
    if (!contatoId.success) return response.status(400).json({ mensagem: "Contato inválido." });
    try {
      return response.json(await new ObterContatoService(prisma).execute(contatoId.data));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "CONTATO_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Contato não encontrado." });
      }
      throw erro;
    }
  },
);
