import { Router } from "express";
import { z } from "zod";

import { autenticarOperador } from "../auth/autenticarOperador";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { prisma } from "../../shared/prisma";
import { SolicitarProvisionamento } from "./SolicitarProvisionamento";
import { RetomarProvisionamentoService } from "./RetomarProvisionamentoService";
import { ListarEventosProvisionamentoService } from "./ListarEventosProvisionamentoService";
import { ListarAmbientesTenantService } from "./ListarAmbientesTenantService";

export const provisionamentoRoutes = Router();

const solicitacaoSchema = z.object({
  assinanteId: z.string().uuid(),
  regiao: z.string().regex(/^[a-z0-9-]{2,80}$/),
  schemaVersaoDesejada: z.string().trim().min(1).max(100),
}).strict();

const filtrosEventosSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  status: z.enum(["PENDENTE", "EXECUTANDO", "CONCLUIDO", "FALHOU"]).optional(),
  tipo: z.enum([
    "CRIAR_AMBIENTE", "APLICAR_MIGRATIONS", "ROTACIONAR_CREDENCIAL",
    "SUSPENDER", "REATIVAR",
  ]).optional(),
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(({ inicio, fim }) => !inicio || !fim || inicio <= fim, {
  message: "Período inválido.", path: ["fim"],
});

const filtrosAmbientesSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  status: z.enum([
    "PENDENTE", "CRIANDO_PROJETO", "GRAVANDO_SEGREDO", "APLICANDO_MIGRATIONS",
    "EXECUTANDO_BOOTSTRAP", "VALIDANDO", "ATIVO", "FALHOU", "SUSPENSO", "DESATIVADO",
  ]).optional(),
  provider: z.string().trim().regex(/^[A-Za-z0-9_-]{2,50}$/).transform((valor) => valor.toUpperCase()).optional(),
  regiao: z.string().trim().regex(/^[A-Za-z0-9_-]{2,80}$/).optional(),
  schemaDesatualizado: z.enum(["true", "false"])
    .transform((valor) => valor === "true").optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

provisionamentoRoutes.get(
  "/ambientes",
  autenticarOperador(["OPERADOR", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosAmbientesSchema.safeParse(request.query);
    if (!filtros.success) {
      return response.status(400).json({ mensagem: "Filtros de ambientes inválidos." });
    }
    return response.json(await new ListarAmbientesTenantService(prisma).execute(filtros.data));
  },
);

provisionamentoRoutes.get(
  "/eventos",
  autenticarOperador(["OPERADOR", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosEventosSchema.safeParse(request.query);
    if (!filtros.success) {
      return response.status(400).json({ mensagem: "Filtros de provisionamento inválidos." });
    }
    return response.json(await new ListarEventosProvisionamentoService(prisma).execute(filtros.data));
  },
);

provisionamentoRoutes.post(
  "/solicitacoes",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const validacao = solicitacaoSchema.safeParse(request.body);
    if (!validacao.success) return response.status(400).json({ mensagem: "Solicitação inválida." });
    try {
      const resultado = await new SolicitarProvisionamento(prisma).execute(
        validacao.data,
        contextoAuditoria(request, response),
      );
      return response.status(resultado.duplicado ? 200 : 202).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Assinante não encontrado." });
      }
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "Assinante não está elegível para provisionamento." });
      }
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "Assinante não possui assinatura elegível para provisionamento." });
      }
      throw erro;
    }
  },
);

provisionamentoRoutes.post(
  "/solicitacoes/:eventoId/retomar",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const eventoId = z.string().uuid().safeParse(request.params.eventoId);
    if (!eventoId.success) return response.status(400).json({ mensagem: "Evento inválido." });
    try {
      const resultado = await new RetomarProvisionamentoService(prisma).execute(
        eventoId.data,
        contextoAuditoria(request, response),
      );
      return response.status(resultado.duplicado ? 200 : 202).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "EVENTO_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Evento de provisionamento não encontrado." });
      }
      if (erro instanceof Error && erro.message === "EVENTO_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "Evento ainda não está elegível para retomada manual." });
      }
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "Assinante não possui assinatura elegível para retomada." });
      }
      throw erro;
    }
  },
);
