import { PerfilOperador } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { autenticarOperador } from "../auth/autenticarOperador";
import { CriarOperadorService } from "./CriarOperadorService";

export const operadoresRoutes = Router();

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
