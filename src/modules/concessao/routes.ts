import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../shared/prisma";
import { autenticarOperador } from "../auth/autenticarOperador";
import { EnviarConcessaoService } from "./EnviarConcessaoService";

export const concessaoRoutes = Router();

concessaoRoutes.post(
  "/:ambienteId/enviar",
  autenticarOperador(["OPERADOR", "ADMIN_PLATAFORMA"]),
  async (request, response) => {
    const ambienteId = z.string().uuid().safeParse(request.params.ambienteId);
    if (!ambienteId.success) return response.status(400).json({ mensagem: "Ambiente inválido." });

    try {
      const resultado = await new EnviarConcessaoService(prisma).execute(ambienteId.data);
      return response.status(200).json(resultado);
    } catch (erro) {
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ENCONTRADO") {
        return response.status(404).json({ mensagem: "Ambiente não encontrado." });
      }
      if (erro instanceof Error && erro.message === "AMBIENTE_NAO_ELEGIVEL") {
        return response.status(409).json({ mensagem: "A concessão só pode ser enviada para um ambiente ativo." });
      }
      if (erro instanceof Error && erro.message === "CONCESSAO_CHAVE_PRIVADA_AUSENTE") {
        return response.status(503).json({ mensagem: "A chave privada de concessão não está configurada no Control Plane." });
      }
      if (erro instanceof Error && erro.message === "CONCESSAO_CHAVE_PRIVADA_INVALIDA") {
        return response.status(503).json({ mensagem: "A chave privada de concessão configurada no Control Plane é inválida." });
      }
      if (erro instanceof Error && erro.message === "CONCESSAO_MAPA_DESTINO_INVALIDO") {
        return response.status(503).json({ mensagem: "O mapa de destino dos tenants está inválido no Control Plane." });
      }
      if (erro instanceof Error && erro.message === "TENANT_APP_BASE_DOMAIN não configurado corretamente.") {
        return response.status(503).json({ mensagem: "Nenhum destino válido foi configurado para o tenant." });
      }
      if (erro instanceof Error && erro.message === "ENTREGA_CONCESSAO_INCERTA") {
        return response.status(504).json({
          mensagem: "O tenant não confirmou a concessão; o resultado da entrega é incerto.",
        });
      }
      if (erro instanceof Error && erro.message.startsWith("ENTREGA_CONCESSAO_RECUSADA:")) {
        return response.status(502).json({ mensagem: "O tenant recusou a concessão." });
      }
      if (erro instanceof Error && erro.message === "RESPOSTA_TENANT_INVALIDA") {
        return response.status(502).json({ mensagem: "O tenant respondeu em formato inválido." });
      }
      throw erro;
    }
  },
);
