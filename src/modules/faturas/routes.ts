import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { competenciaSchema } from "../comercial/regrasComerciais";
import { GerarFaturaService } from "./GerarFaturaService";
import { EmitirFaturaService } from "./EmitirFaturaService";

export const faturasRoutes = Router();

const gerarSchema = z.object({
  assinanteId: z.string().uuid(),
  competencia: competenciaSchema,
}).strict();

faturasRoutes.post(
  "/gerar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const dados = gerarSchema.safeParse(request.body);
    if (!dados.success) return response.status(400).json({ mensagem: "Dados de faturamento inválidos." });
    try {
      const resultado = await new GerarFaturaService(prisma).execute(
        dados.data.assinanteId,
        dados.data.competencia,
        contextoAuditoria(request, response),
      );
      return response.status(resultado.duplicado ? 200 : 201).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_FATURAVEL") {
        return response.status(409).json({ mensagem: "Assinante não possui assinatura faturável." });
      }
      if (erro instanceof Error && erro.message === "SNAPSHOT_NAO_ENCONTRADO") {
        return response.status(409).json({ mensagem: "Não há contagem agregada para a competência." });
      }
      if (erro instanceof Error && erro.message === "SEM_UNIDADES_FATURAVEIS") {
        return response.status(409).json({ mensagem: "Não há unidades ativas para faturar." });
      }
      throw erro;
    }
  },
);

faturasRoutes.post(
  "/:faturaId/emitir",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const faturaId = z.string().uuid().safeParse(request.params.faturaId);
    if (!faturaId.success) return response.status(400).json({ mensagem: "Fatura inválida." });
    try {
      const resultado = await new EmitirFaturaService(prisma).execute(
        faturaId.data,
        contextoAuditoria(request, response),
      );
      return response.status(200).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "FATURA_NAO_ENCONTRADA") {
        return response.status(404).json({ mensagem: "Fatura não encontrada." });
      }
      if (erro instanceof Error && erro.message === "FATURA_NAO_EMITIVEL") {
        return response.status(409).json({ mensagem: "Fatura não está em estado válido para emissão." });
      }
      throw erro;
    }
  },
);
