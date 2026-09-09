import { Router } from "express";
import { IntencaoSolicitacaoAssinatura, StatusSolicitacaoAssinatura } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { contextoAuditoria } from "../auditoria/contextoAuditoria";
import { validarChavePublica } from "./ChavesSolicitacaoPublica";
import { LimitarSolicitacaoPublicaService } from "./LimitarSolicitacaoPublicaService";
import { CriarSolicitacaoService } from "./CriarSolicitacaoService";
import { ListarSolicitacoesService } from "./ListarSolicitacoesService";
import { DecidirSolicitacaoService } from "./DecidirSolicitacaoService";
import { ConverterSolicitacaoService } from "./ConverterSolicitacaoService";

export const solicitacoesRoutes = Router();
const produto = z.enum(["sysbelt", "mecanix", "psyche"]);
const criarSchema = z.object({ produtoId: produto, intencao: z.nativeEnum(IntencaoSolicitacaoAssinatura),
  nomeOrganizacao: z.string().trim().min(2).max(200), documento: z.string().transform(v => v.replace(/\D/g, ""))
    .refine(v => v.length === 11 || v.length === 14), responsavel: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), telefone: z.string().trim().min(8).max(30).optional(),
  origem: z.record(z.string().min(1).max(50), z.string().max(500)).optional() }).strict();

solicitacoesRoutes.post("/", async (request, response) => {
  const dados = criarSchema.safeParse(request.body);
  if (!dados.success) return response.status(400).json({ mensagem: "Solicitação inválida." });
  if (!validarChavePublica(dados.data.produtoId, request.get("x-control-plane-public-key"))) {
    return response.status(401).json({ mensagem: "Chave pública do produto inválida." });
  }
  if (!await new LimitarSolicitacaoPublicaService(prisma).consumir(request.ip || "desconhecido", dados.data.produtoId)) {
    return response.status(429).json({ mensagem: "Limite de solicitações excedido. Tente novamente mais tarde." });
  }
  try { return response.status(201).json(await new CriarSolicitacaoService(prisma).execute(dados.data)); }
  catch (erro) { if (erro instanceof Error && erro.message === "PRODUTO_NAO_ENCONTRADO") return response.status(404).json({ mensagem: "Produto não encontrado." }); throw erro; }
});

const filtrosSchema = z.object({ produtoId: produto.optional(), status: z.nativeEnum(StatusSolicitacaoAssinatura).optional(),
  intencao: z.nativeEnum(IntencaoSolicitacaoAssinatura).optional(), inicio: z.coerce.date().optional(), fim: z.coerce.date().optional(),
  pagina: z.coerce.number().int().positive().default(1), limite: z.coerce.number().int().min(1).max(100).default(20) }).strict()
  .refine(f => !f.inicio || !f.fim || f.inicio <= f.fim);
solicitacoesRoutes.get("/", autenticarOperador(), async (request, response) => {
  const f = filtrosSchema.safeParse(request.query);
  if (!f.success) return response.status(400).json({ mensagem: "Filtros inválidos." });
  return response.json(await new ListarSolicitacoesService(prisma).execute(f.data));
});

const idSchema = z.string().uuid();
for (const [caminho, decisao] of [["aprovar", "APROVADA"], ["recusar", "RECUSADA"]] as const) {
  solicitacoesRoutes.post(`/:id/${caminho}`, autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]), async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    const corpo = z.object({ motivo: decisao === "RECUSADA" ? z.string().trim().min(3).max(500) : z.string().trim().max(500).optional() }).strict().safeParse(request.body);
    if (!id.success || !corpo.success) return response.status(400).json({ mensagem: "Decisão inválida." });
    try { return response.json(await new DecidirSolicitacaoService(prisma).execute(id.data, decisao, corpo.data.motivo, contextoAuditoria(request, response))); }
    catch (erro) { if (erro instanceof Error && erro.message === "SOLICITACAO_NAO_ENCONTRADA") return response.status(404).json({ mensagem: "Solicitação não encontrada." });
      if (erro instanceof Error && erro.message === "SOLICITACAO_JA_DECIDIDA") return response.status(409).json({ mensagem: "Solicitação já decidida." }); throw erro; }
  });
}

solicitacoesRoutes.post("/:id/converter", autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]), async (request, response) => {
  const id = idSchema.safeParse(request.params.id);
  if (!id.success) return response.status(400).json({ mensagem: "Solicitação inválida." });
  try { const r = await new ConverterSolicitacaoService(prisma).execute(id.data, contextoAuditoria(request, response));
    return response.status(r.idempotente ? 200 : 201).json(r); }
  catch (erro) { if (erro instanceof Error && erro.message === "SOLICITACAO_NAO_ENCONTRADA") return response.status(404).json({ mensagem: "Solicitação não encontrada." });
    if (erro instanceof Error && ["SOLICITACAO_NAO_APROVADA", "ASSINANTE_DUPLICADO"].includes(erro.message)) return response.status(409).json({ mensagem: "Solicitação não pode ser convertida." }); throw erro; }
});
