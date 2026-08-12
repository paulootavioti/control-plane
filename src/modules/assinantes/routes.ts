import { Router } from "express";
import { StatusAssinante, TipoContatoAssinante } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarAssinantesService } from "./ListarAssinantesService";
import { ObterAssinanteService } from "./ObterAssinanteService";
import { CriarAssinanteService } from "./CriarAssinanteService";
import { ContratarAssinaturaService } from "./ContratarAssinaturaService";
import { assinaturaSchema } from "../comercial/regrasComerciais";

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
}).strict();

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
      const resultado = await new CriarAssinanteService(prisma).execute(validacao.data);
      return response.status(201).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "ASSINANTE_DUPLICADO") {
        return response.status(409).json({ mensagem: "Documento ou slug já cadastrado." });
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
      const resultado = await new ContratarAssinaturaService(prisma).execute(assinanteId.data, dados.data);
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
