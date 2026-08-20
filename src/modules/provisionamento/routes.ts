import { Router } from "express";
import { z } from "zod";

import { autenticarOperador } from "../auth/autenticarOperador";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { prisma } from "../../shared/prisma";
import { SolicitarProvisionamento } from "./SolicitarProvisionamento";
import { RetomarProvisionamentoService } from "./RetomarProvisionamentoService";
import { ListarEventosProvisionamentoService } from "./ListarEventosProvisionamentoService";
import { ListarAmbientesTenantService } from "./ListarAmbientesTenantService";
import { ObterAmbienteTenantService } from "./ObterAmbienteTenantService";
import { ObterEventoProvisionamentoService } from "./ObterEventoProvisionamentoService";
import { SolicitarRotacaoCredencialService } from "./SolicitarRotacaoCredencialService";
import { SolicitarAtualizacaoSchemaService } from "./SolicitarAtualizacaoSchemaService";
import { SolicitarEstadoAmbienteService } from "./SolicitarEstadoAmbienteService";

export const provisionamentoRoutes = Router();

provisionamentoRoutes.post(
  "/ambientes/:ambienteId/rotacionar-credencial",
  autenticarOperador(["ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const ambienteId = z.string().uuid().safeParse(request.params.ambienteId);
    if (!ambienteId.success) return response.status(400).json({ mensagem: "Ambiente inválido." });
    try {
      const resultado = await new SolicitarRotacaoCredencialService(prisma).execute(
        ambienteId.data,
        contextoAuditoria(request, response),
      );
      return response.status(resultado.duplicado ? 200 : 202).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Ambiente não encontrado." });
      }
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "Ambiente não está ativo." });
      }
      throw erro;
    }
  },
);
for (const [caminho, operacao] of [["suspender", "SUSPENDER"], ["reativar", "REATIVAR"]] as const) {
  provisionamentoRoutes.post(`/ambientes/:ambienteId/${caminho}`, autenticarOperador(["ADMIN_PLATAFORMA"]), async (request, response) => {
    const id = z.string().uuid().safeParse(request.params.ambienteId);
    if (!id.success) return response.status(400).json({ mensagem: "Ambiente inválido." });
    try {
      const resultado = await new SolicitarEstadoAmbienteService(prisma).execute(id.data, operacao, contextoAuditoria(request, response));
      return response.status(resultado.duplicado ? 200 : 202).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ENCONTRADO") return response.status(404).json({ mensagem: "Ambiente não encontrado." });
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_ELEGIVEL") return response.status(409).json({ mensagem: "Assinatura não permite reativação." });
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ELEGIVEL") return response.status(409).json({ mensagem: "Transição de ambiente inválida." });
      throw erro;
    }
  });
}

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
  "/ambientes/:ambienteId",
  autenticarOperador(["OPERADOR", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const ambienteId = z.string().uuid().safeParse(request.params.ambienteId);
    if (!ambienteId.success) return response.status(400).json({ mensagem: "Ambiente inválido." });
    try {
      return response.json(await new ObterAmbienteTenantService(prisma).execute(ambienteId.data));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Ambiente não encontrado." });
      }
      throw erro;
    }
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

provisionamentoRoutes.get(
  "/eventos/:eventoId",
  autenticarOperador(["OPERADOR", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const eventoId = z.string().uuid().safeParse(request.params.eventoId);
    if (!eventoId.success) return response.status(400).json({ mensagem: "Evento inválido." });
    try {
      return response.json(await new ObterEventoProvisionamentoService(prisma).execute(eventoId.data));
    } catch (erro) {
      if (erro instanceof Error && erro.message === "EVENTO_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Evento de provisionamento não encontrado." });
      }
      throw erro;
    }
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

provisionamentoRoutes.post("/ambientes/:ambienteId/migrations", autenticarOperador(["ADMIN_PLATAFORMA"]), async (request, response) => {
  const parametros = z.object({ ambienteId: z.string().uuid() }).safeParse(request.params);
  const dados = z.object({ schemaVersaoDesejada: z.string().trim().min(1).max(100) }).strict().safeParse(request.body);
  if (!parametros.success || !dados.success) return response.status(400).json({ mensagem: "Atualização de schema inválida." });
  try {
    const resultado = await new SolicitarAtualizacaoSchemaService(prisma).execute(parametros.data.ambienteId, dados.data.schemaVersaoDesejada, contextoAuditoria(request,response));
    return response.status(resultado.duplicado ? 200 : 202).json(resultado);
  } catch (erro) {
    if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ENCONTRADO") return response.status(404).json({ mensagem: "Ambiente não encontrado." });
    if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ELEGIVEL") return response.status(409).json({ mensagem: "Ambiente não está ativo." });
    throw erro;
  }
});

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
