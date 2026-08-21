import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const credenciaisSchema = z.partialRecord(
  z.enum(["sysbelt", "mecanix", "psyche"]),
  z.record(z.string().regex(/^v[1-9]\d*$/), z.string().min(32)),
);

function compararConstante(recebido: string, esperado: string): boolean {
  const candidato = Buffer.from(recebido);
  const referencia = Buffer.from(esperado);
  return candidato.length === referencia.length && timingSafeEqual(candidato, referencia);
}

function credenciaisConfiguradas() {
  const bruto = process.env.CONTROL_PLANE_PRODUCT_CREDENTIALS;
  if (!bruto) throw new Error("CONTROL_PLANE_PRODUCT_CREDENTIALS não configurado.");
  const resultado = credenciaisSchema.safeParse(JSON.parse(bruto));
  if (!resultado.success) throw new Error("CONTROL_PLANE_PRODUCT_CREDENTIALS inválido.");
  return resultado.data;
}

function produtoDaRequisicao(request: Request): string {
  const parametro = request.params.produto;
  return (Array.isArray(parametro) ? parametro[0] : parametro)
    ?? request.header("x-control-plane-product") ?? "sysbelt";
}

export function autenticarDiretorio(request: Request, response: Response, next: NextFunction) {
  const produto = produtoDaRequisicao(request);
  const bearer = request.header("authorization")?.match(/^Bearer (.+)$/i)?.[1] ?? "";
  const versao = request.header("x-control-plane-credential-version") ?? "";

  if (bearer && versao) {
    const esperado = credenciaisConfiguradas()[produto as "sysbelt" | "mecanix" | "psyche"]?.[versao];
    if (esperado && compararConstante(bearer, esperado)) return next();
    return response.status(401).json({ codigo: "CREDENCIAL_PRODUTO_INVALIDA", mensagem: "Integração não autorizada." });
  }

  if (process.env.CONTROL_PLANE_DIRECTORY_LEGACY_ENABLED === "true" && produto === "sysbelt") {
    const esperado = process.env.CONTROL_PLANE_DIRECTORY_SECRET?.trim() ?? "";
    const recebido = request.header("x-sysbelt-directory-secret") ?? "";
    if (esperado.length >= 32 && compararConstante(recebido, esperado)) {
      response.setHeader("deprecation", "true");
      response.setHeader("sunset", process.env.CONTROL_PLANE_DIRECTORY_LEGACY_SUNSET ?? "");
      return next();
    }
  }

  return response.status(401).json({ codigo: "CREDENCIAL_PRODUTO_AUSENTE", mensagem: "Integração não autorizada." });
}
