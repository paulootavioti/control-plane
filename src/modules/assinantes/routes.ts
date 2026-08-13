import { Router } from "express";
import { StatusAssinante, StatusAssinatura, TipoContatoAssinante } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarAssinantesService } from "./ListarAssinantesService";
import { ObterAssinanteService } from "./ObterAssinanteService";
import { CriarAssinanteService } from "./CriarAssinanteService";
import { ContratarAssinaturaService } from "./ContratarAssinaturaService";
import { assinaturaSchema } from "../comercial/regrasComerciais";
import { AlterarStatusAssinaturaService } from "./AlterarStatusAssinaturaService";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { TrocarPlanoAssinaturaService } from "./TrocarPlanoAssinaturaService";
import { CriarContatoAssinanteService } from "./CriarContatoAssinanteService";

export const assinantesRoutes = Router();

const filtrosSchema = z.object({
  busca: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(StatusAssinante).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

const contatoSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional(),
  telefone: z.string().trim().min(8).max(30).optional(),
  tipo: z.nativeEnum(TipoContatoAssinante),
  principal: z.boolean().default(false),
}).strict().refine(
  ({ email, telefone }) => Boolean(email || telefone),
  { message: "Informe e-mail ou telefone.", path: ["email"] },
);

const novoAssinanteSchema = z.object({
  nomeFantasia: z.string().trim().min(2).max(160),
  razaoSocial: z.string().trim().min(2).max(200).optional(),
  documento: z.string().transform((valor) => valor.replace(/\D/g, ""))
    .refine((valor) => valor.length === 11 || valor.length === 14, "Documento inválido."),
  emailCobranca: z.string().trim().email().max(254).transform((valor) => valor.toLowerCase()),
  telefone: z.string().trim().min(8).max(30).optional(),
  slug: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  contatos: z.array(contatoSchema).max(10).default([]),
}).strict().refine(
  ({ contatos }) => contatos.filter((contato) => contato.principal).length <= 1,
  { message: "Informe no máximo um contato principal.", path: ["contatos"] },
);

assinantesRoutes.post(
  "/",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const validacao = novoAssinanteSchema.safeParse(request.body);
    if (!validacao.success) return response.status(400).json({ mensagem: "Dados do assinante inválidos." });
    try {
      const resultado = await new CriarAssinanteService(prisma).execute(validacao.data, contextoAuditoria(request, response));
      return response.status(201).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_DUPLICADO") {
        return response.status(409).json({ mensagem: "Documento ou slug já cadastrado." });
      }
      throw erro;
    }
  },
);

assinantesRoutes.post(
  "/:assinanteId/contatos",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const assinanteId = z.string().uuid().safeParse(request.params.assinanteId);
    const dados = contatoSchema.safeParse(request.body);
    if (!assinanteId.success || !dados.success) {
      return response.status(400).json({ mensagem: "Dados do contato inválidos." });
    }
    try {
      const contato = await new CriarContatoAssinanteService(prisma).execute(
        assinanteId.data,
        { ...dados.data, email: dados.data.email?.toLowerCase() },
        contextoAuditoria(request, response),
      );
      return response.status(201).json(contato);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Assinante não encontrado." });
      }
      if (erro instanceof Error && erro.message === "CONTATO_PRINCIPAL_CONCORRENTE") {
        return response.status(409).json({ mensagem: "Outro contato principal foi definido simultaneamente." });
      }
      throw erro;
    }
  },
);

const alterarStatusAssinaturaSchema = z.object({
  status: z.nativeEnum(StatusAssinatura).refine((status) => status !== "TESTE"),
}).strict();

assinantesRoutes.patch(
  "/:assinanteId/assinaturas/:assinaturaId/status",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const ids = z.object({ assinanteId: z.string().uuid(), assinaturaId: z.string().uuid() })
      .safeParse(request.params);
    const dados = alterarStatusAssinaturaSchema.safeParse(request.body);
    if (!ids.success || !dados.success) return response.status(400).json({ mensagem: "Transição inválida." });
    try {
      const resultado = await new AlterarStatusAssinaturaService(prisma).execute(
        ids.data.assinanteId, ids.data.assinaturaId, dados.data.status, contextoAuditoria(request, response),
      );
      return response.json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_ENCONTRADA") {
        return response.status(404).json({ mensagem: "Assinatura não encontrada." });
      }
      if (erro instanceof Error && ["STATUS_JA_APLICADO", "TRANSICAO_INVALIDA"].includes(erro.message)) {
        return response.status(409).json({ mensagem: "Transição de assinatura não permitida." });
      }
      throw erro;
    }
  },
);

const trocaPlanoSchema = z.object({ planoId: z.string().uuid() }).strict();

assinantesRoutes.post(
  "/:assinanteId/assinaturas/:assinaturaId/trocar-plano",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const ids = z.object({ assinanteId: z.string().uuid(), assinaturaId: z.string().uuid() })
      .safeParse(request.params);
    const dados = trocaPlanoSchema.safeParse(request.body);
    if (!ids.success || !dados.success) return response.status(400).json({ mensagem: "Troca de plano inválida." });
    try {
      const resultado = await new TrocarPlanoAssinaturaService(prisma).execute(
        ids.data.assinanteId,
        ids.data.assinaturaId,
        dados.data.planoId,
        contextoAuditoria(request, response),
      );
      return response.status(resultado.alterada ? 201 : 200).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Assinante não encontrado." });
      }
      if (erro instanceof Error && erro.message === "ASSINATURA_NAO_ENCONTRADA") {
        return response.status(404).json({ mensagem: "Assinatura não encontrada." });
      }
      if (erro instanceof Error && [
        "PLANO_NAO_ELEGIVEL", "ASSINATURA_ENCERRADA", "ASSINATURA_NAO_ELEGIVEL",
        "PLANO_JA_APLICADO", "ASSINATURA_CORRENTE_CONFLITANTE", "TROCA_PLANO_CONCORRENTE",
      ].includes(erro.message)) {
        return response.status(409).json({ mensagem: "Troca de plano não permitida." });
      }
      throw erro;
    }
  },
);

assinantesRoutes.get("/", autenticarOperador(), async (request, response) => {
  const validacao = filtrosSchema.safeParse(request.query);
  if (!validacao.success) return response.status(400).json({ mensagem: "Filtros inválidos." });

  const resultado = await new ListarAssinantesService(prisma).execute(validacao.data);
  return response.json(resultado);
});

assinantesRoutes.get("/:assinanteId", autenticarOperador(), async (request, response) => {
  const assinanteId = z.string().uuid().safeParse(request.params.assinanteId);
  if (!assinanteId.success) return response.status(400).json({ mensagem: "Assinante inválido." });

  try {
    const resultado = await new ObterAssinanteService(prisma).execute(assinanteId.data);
    return response.json(resultado);
  } catch (erro) {
    if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") {
      return response.status(404).json({ mensagem: "Assinante não encontrado." });
    }
    throw erro;
  }
});

const contratacaoSchema = assinaturaSchema.extend({
  planoVersaoId: z.string().uuid(),
  status: z.enum(["TESTE", "ATIVA"]),
  testeAte: z.coerce.date().optional(),
}).strict();

assinantesRoutes.post(
  "/:assinanteId/assinaturas",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const assinanteId = z.string().uuid().safeParse(request.params.assinanteId);
    const dados = contratacaoSchema.safeParse(request.body);
    if (!assinanteId.success || !dados.success) return response.status(400).json({ mensagem: "Contratação inválida." });
    try {
      const resultado = await new ContratarAssinaturaService(prisma).execute(
        assinanteId.data, dados.data, contextoAuditoria(request, response),
      );
      return response.status(201).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_NAO_ENCONTRADO") return response.status(404).json({ mensagem: "Assinante não encontrado." });
      if (erro instanceof Error && ["ASSINANTE_NAO_ELEGIVEL", "ASSINATURA_CORRENTE_EXISTE", "PLANO_VERSAO_NAO_ELEGIVEL", "PERIODO_TESTE_INVALIDO"].includes(erro.message)) {
        return response.status(409).json({ mensagem: "Assinante, plano ou período não elegível para contratação." });
      }
      throw erro;
    }
  },
);
