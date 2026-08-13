import { PerfilOperador } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { autenticarOperador } from "../auth/autenticarOperador";
import { CriarOperadorService } from "./CriarOperadorService";
import { ListarOperadoresService } from "./ListarOperadoresService";
import { AlterarStatusOperadorService } from "./AlterarStatusOperadorService";

export const operadoresRoutes = Router();

const alterarStatusSchema = z.object({ ativo: z.boolean() }).strict();

operadoresRoutes.patch(
  "/:operadorId/status",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const operadorId = z.string().uuid().safeParse(request.params.operadorId);
    const dados = alterarStatusSchema.safeParse(request.body);
    if (!operadorId.success || !dados.success) {
      return response.status(400).json({ mensagem: "Alteração de operador inválida." });
    }
    try {
      return response.json(await new AlterarStatusOperadorService(prisma).execute(
        operadorId.data, dados.data.ativo, contextoAuditoria(request, response),
      ));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "OPERADOR_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Operador não encontrado." });
      }
      if (erro instanceof Error && erro.message === "AUTODESATIVACAO_NAO_PERMITIDA") {
        return response.status(409).json({ mensagem: "Não é permitido desativar o próprio operador." });
      }
      if (erro instanceof Error && erro.message === "ULTIMO_ADMIN_ATIVO") {
        return response.status(409).json({ mensagem: "A plataforma precisa manter um administrador ativo." });
      }
      throw erro;
    }
  },
);

const filtrosOperadoresSchema = z.object({
  busca: z.string().trim().min(1).max(120).optional(),
  perfil: z.nativeEnum(PerfilOperador).optional(),
  ativo: z.enum(["true", "false"]).transform((valor) => valor === "true").optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

operadoresRoutes.get(
  "/",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosOperadoresSchema.safeParse(request.query);
    if (!filtros.success) return response.status(400).json({ mensagem: "Filtros de operadores inválidos." });
    return response.json(await new ListarOperadoresService(prisma).execute(filtros.data));
  },
);

const novoOperadorSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  senha: z.string().min(8).max(128),
  perfil: z.nativeEnum(PerfilOperador),
}).strict();

operadoresRoutes.post(
  "/",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const dados = novoOperadorSchema.safeParse(request.body);
    if (!dados.success) return response.status(400).json({ mensagem: "Dados do operador inválidos." });
    try {
      const operador = await new CriarOperadorService(prisma).execute(
        dados.data,
        contextoAuditoria(request, response),
      );
      return response.status(201).json(operador);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "OPERADOR_DUPLICADO") {
        return response.status(409).json({ mensagem: "Já existe um operador com este e-mail." });
      }
      throw erro;
    }
  },
);
