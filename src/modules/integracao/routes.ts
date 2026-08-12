import { Router } from "express";

import { prisma } from "../../shared/prisma";
import { verificarAssinaturaTenant } from "./assinaturaTenant";
import { contagemContratoV1Schema } from "./contagemContrato";
import { ReceberSnapshotContagem } from "./ReceberSnapshotContagem";

export const integracaoRoutes = Router();

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
