import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { verificarAssinaturaTenant } from "./assinaturaTenant";
import { contagemContratoV1Schema } from "./contagemContrato";
import { ReceberSnapshotContagem } from "./ReceberSnapshotContagem";
import { ListarSnapshotsContagemService } from "./ListarSnapshotsContagemService";
import { autenticarOperador } from "../auth/autenticarOperador";
import { ListarLicencasUnidadeService } from "./ListarLicencasUnidadeService";

export const integracaoRoutes = Router();

const filtrosContagensSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  dataCorteInicio: z.coerce.date().optional(),
  dataCorteFim: z.coerce.date().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(
  ({ dataCorteInicio, dataCorteFim }) => !dataCorteInicio || !dataCorteFim || dataCorteInicio <= dataCorteFim,
  { message: "Período de corte inválido.", path: ["dataCorteFim"] },
);

const filtrosLicencasSchema = z.object({
  assinanteId: z.string().uuid().optional(),
  status: z.enum(["PENDENTE", "ATIVA", "ENCERRADA"]).optional(),
  busca: z.string().trim().min(1).max(120).optional(),
  sincronizadaInicio: z.coerce.date().optional(),
  sincronizadaFim: z.coerce.date().optional(),
  desatualizadaAntes: z.coerce.date().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((filtros, ctx) => {
  if (filtros.sincronizadaInicio && filtros.sincronizadaFim && filtros.sincronizadaInicio > filtros.sincronizadaFim) {
    ctx.addIssue({ code: "custom", message: "Período de sincronização inválido.", path: ["sincronizadaFim"] });
  }
  if (filtros.desatualizadaAntes && (filtros.sincronizadaInicio || filtros.sincronizadaFim)) {
    ctx.addIssue({ code: "custom", message: "Escolha período ou desatualização.", path: ["desatualizadaAntes"] });
  }
});

integracaoRoutes.get(
  "/licencas",
  autenticarOperador(["OPERADOR", "FINANCEIRO", "SUPORTE", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosLicencasSchema.safeParse(request.query);
    if (!filtros.success) return response.status(400).json({ mensagem: "Filtros de licenças inválidos." });
    return response.json(await new ListarLicencasUnidadeService(prisma).execute(filtros.data));
  },
);

integracaoRoutes.get(
  "/contagens",
  autenticarOperador(["FINANCEIRO", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const filtros = filtrosContagensSchema.safeParse(request.query);
    if (!filtros.success) return response.status(400).json({ mensagem: "Filtros de contagens inválidos." });
    return response.json(await new ListarSnapshotsContagemService(prisma).execute(filtros.data));
  },
);

integracaoRoutes.post("/v1/contagens", async (request, response) => {
  const validacao = contagemContratoV1Schema.safeParse(request.body);
  if (!validacao.success) return response.status(400).json({ mensagem: "Payload inválido." });

  const ambiente = await prisma.ambienteTenant.findUnique({
    where: { tenantKey: validacao.data.tenantKey },
    select: { assinanteId: true, status: true, chavePublicaIntegracao: true },
  });
  if (!ambiente || ambiente.status !== "ATIVO" || !ambiente.chavePublicaIntegracao) {
    return response.status(401).json({ mensagem: "Integração não autorizada." });
  }

  const timestamp = request.header("x-sysbelt-timestamp");
  const assinaturaBase64 = request.header("x-sysbelt-signature");
  if (!timestamp || !assinaturaBase64 || !verificarAssinaturaTenant({
    payload: validacao.data, timestamp, assinaturaBase64,
    chavePublica: ambiente.chavePublicaIntegracao,
  })) {
    return response.status(401).json({ mensagem: "Integração não autorizada." });
  }

  const resultado = await new ReceberSnapshotContagem(prisma).execute(ambiente.assinanteId, validacao.data);
  return response.status(resultado.duplicado ? 200 : 201).json(resultado);
});
