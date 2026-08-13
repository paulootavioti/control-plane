import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { autenticarOperador } from "../auth/autenticarOperador";
import { CriarPlanoService } from "./CriarPlanoService";
import { CriarVersaoPlanoService } from "./CriarVersaoPlanoService";
import { ListarPlanosService } from "./ListarPlanosService";
import { AlterarStatusPlanoService } from "./AlterarStatusPlanoService";
import { ObterPlanoService } from "./ObterPlanoService";

export const planosRoutes = Router();

const planoSchemaBase = z.object({
  nome: z.string().trim().min(2).max(120),
  descricao: z.string().trim().min(1).max(500).optional(),
  vigenteDesde: z.coerce.date(),
  vigenteAte: z.coerce.date().nullable().optional(),
  alunosPorBloco: z.number().int().positive(),
  precoPorBlocoCentavos: z.number().int().positive(),
  blocosMinimosPorUnidade: z.number().int().positive().default(1),
  moeda: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("BRL"),
  recursos: z.record(z.string().min(1).max(100), z.boolean()),
  metadadosComerciais: z.record(z.string().min(1).max(100), z.json()).nullable().optional(),
}).strict();

const validarVigencia = <T extends { vigenteDesde: Date; vigenteAte?: Date | null }>(dados: T) =>
  !dados.vigenteAte || dados.vigenteAte > dados.vigenteDesde;

const novoPlanoSchema = planoSchemaBase.refine(
  validarVigencia,
  { message: "A vigência final precisa ser posterior à inicial.", path: ["vigenteAte"] },
);

planosRoutes.post("/", autenticarOperador(["ADMIN_PLATAFORMA"]), async (request, response) => {
  const dados = novoPlanoSchema.safeParse(request.body);
  if (!dados.success) return response.status(400).json({ mensagem: "Dados do plano inválidos." });

  try {
    const plano = await new CriarPlanoService(prisma).execute(
      dados.data,
      contextoAuditoria(request, response),
    );
    return response.status(201).json(plano);
  } catch (erro) {
    if (erro instanceof Error && erro.message === "PLANO_DUPLICADO") {
      return response.status(409).json({ mensagem: "Já existe um plano com este nome." });
    }
    throw erro;
  }
});

const novaVersaoSchema = planoSchemaBase.omit({ nome: true, descricao: true }).refine(
  validarVigencia,
  { message: "A vigência final precisa ser posterior à inicial.", path: ["vigenteAte"] },
);

planosRoutes.post("/:planoId/versoes", autenticarOperador(["ADMIN_PLATAFORMA"]), async (request, response) => {
  const parametros = z.object({ planoId: z.uuid() }).safeParse(request.params);
  const dados = novaVersaoSchema.safeParse(request.body);
  if (!parametros.success || !dados.success) {
    return response.status(400).json({ mensagem: "Dados da versão do plano inválidos." });
  }

  try {
    const resultado = await new CriarVersaoPlanoService(prisma).execute(
      parametros.data.planoId,
      dados.data,
      contextoAuditoria(request, response),
    );
    return response.status(resultado.criada ? 201 : 200).json(resultado);
  } catch (erro) {
    if (erro instanceof Error && erro.message === "PLANO_NAO_ENCONTRADO") {
      return response.status(404).json({ mensagem: "Plano não encontrado." });
    }
    if (erro instanceof Error && erro.message === "PLANO_INATIVO") {
      return response.status(409).json({ mensagem: "Não é possível versionar um plano inativo." });
    }
    if (erro instanceof Error && ["VIGENCIA_CONFLITANTE", "VIGENCIA_SOBREPOSTA", "VERSAO_CONCORRENTE"].includes(erro.message)) {
      return response.status(409).json({ mensagem: "A vigência informada conflita com o histórico do plano." });
    }
    throw erro;
  }
});

const filtrosSchema = z.object({
  incluirHistorico: z.enum(["true", "false"]).transform((valor) => valor === "true").default(false),
}).strict();

planosRoutes.get("/", autenticarOperador(), async (request, response) => {
  const validacao = filtrosSchema.safeParse(request.query);
  if (!validacao.success) return response.status(400).json({ mensagem: "Filtros inválidos." });

  const planos = await new ListarPlanosService(prisma).execute(validacao.data.incluirHistorico);
  return response.json({ itens: planos });
});

planosRoutes.get("/:planoId", autenticarOperador(), async (request, response) => {
  const planoId = z.uuid().safeParse(request.params.planoId);
  if (!planoId.success) return response.status(400).json({ mensagem: "Plano inválido." });
  try {
    return response.json(await new ObterPlanoService(prisma).execute(planoId.data));
  } catch (erro) {
    if (erro instanceof Error && erro.message === "PLANO_NAO_ENCONTRADO") {
      return response.status(404).json({ mensagem: "Plano não encontrado." });
    }
    throw erro;
  }
});

const alterarStatusSchema = z.object({ ativo: z.boolean() }).strict();

planosRoutes.patch("/:planoId/status", autenticarOperador(["ADMIN_PLATAFORMA"]), async (request, response) => {
  const parametros = z.object({ planoId: z.uuid() }).safeParse(request.params);
  const dados = alterarStatusSchema.safeParse(request.body);
  if (!parametros.success || !dados.success) {
    return response.status(400).json({ mensagem: "Alteração de estado do plano inválida." });
  }

  try {
    return response.json(await new AlterarStatusPlanoService(prisma).execute(
      parametros.data.planoId,
      dados.data.ativo,
      contextoAuditoria(request, response),
    ));
  } catch (erro) {
    if (erro instanceof Error && erro.message === "PLANO_NAO_ENCONTRADO") {
      return response.status(404).json({ mensagem: "Plano não encontrado." });
    }
    throw erro;
  }
});
