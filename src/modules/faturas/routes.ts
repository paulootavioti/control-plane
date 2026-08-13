import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { competenciaSchema } from "../comercial/regrasComerciais";
import { GerarFaturaService } from "./GerarFaturaService";
import { EmitirFaturaService } from "./EmitirFaturaService";
import { ObterFaturaService } from "./ObterFaturaService";
import { CancelarFaturaService } from "./CancelarFaturaService";
import { RegistrarPagamentoFaturaService } from "./RegistrarPagamentoFaturaService";

export const faturasRoutes = Router();

faturasRoutes.get("/:faturaId", autenticarOperador(), async (request, response) => {
  const faturaId = z.string().uuid().safeParse(request.params.faturaId);
  if (!faturaId.success) return response.status(400).json({ mensagem: "Fatura inválida." });
  try {
    return response.json(await new ObterFaturaService(prisma).execute(faturaId.data));
  } catch (erro) {
    if (erro instanceof Error && erro.message === "FATURA_NAO_ENCONTRADA") {
      return response.status(404).json({ mensagem: "Fatura não encontrada." });
    }
    throw erro;
  }
});

const gerarSchema = z.object({
  assinanteId: z.string().uuid(),
  competencia: competenciaSchema,
}).strict();

const cancelamentoSchema = z.object({
  motivo: z.string().trim().min(5).max(500),
}).strict();

const pagamentoSchema = z.object({
  gateway: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/),
  referenciaPagamento: z.string().trim().min(1).max(200),
}).strict();

faturasRoutes.post(
  "/:faturaId/pagar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const faturaId = z.string().uuid().safeParse(request.params.faturaId);
    const dados = pagamentoSchema.safeParse(request.body);
    if (!faturaId.success || !dados.success) return response.status(400).json({ mensagem: "Pagamento inválido." });
    try {
      return response.json(await new RegistrarPagamentoFaturaService(prisma).execute(
        faturaId.data, dados.data.gateway, dados.data.referenciaPagamento,
        contextoAuditoria(request, response),
      ));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "FATURA_NAO_ENCONTRADA") {
        return response.status(404).json({ mensagem: "Fatura não encontrada." });
      }
      if (erro instanceof Error && ["FATURA_NAO_PAGAVEL", "FATURA_JA_PAGA"].includes(erro.message)) {
        return response.status(409).json({ mensagem: "Fatura não está em estado válido para pagamento." });
      }
      if (erro instanceof Error && erro.message === "REFERENCIA_PAGAMENTO_JA_UTILIZADA") {
        return response.status(409).json({ mensagem: "Referência de pagamento já utilizada." });
      }
      throw erro;
    }
  },
);

faturasRoutes.post(
  "/:faturaId/cancelar",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const faturaId = z.string().uuid().safeParse(request.params.faturaId);
    const dados = cancelamentoSchema.safeParse(request.body);
    if (!faturaId.success || !dados.success) return response.status(400).json({ mensagem: "Cancelamento inválido." });
    try {
      return response.json(await new CancelarFaturaService(prisma).execute(
        faturaId.data, dados.data.motivo, contextoAuditoria(request, response),
      ));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "FATURA_NAO_ENCONTRADA") {
        return response.status(404).json({ mensagem: "Fatura não encontrada." });
      }
      if (erro instanceof Error && erro.message === "FATURA_NAO_CANCELAVEL") {
        return response.status(409).json({ mensagem: "Fatura não está em estado válido para cancelamento." });
      }
      throw erro;
    }
  },
);

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
