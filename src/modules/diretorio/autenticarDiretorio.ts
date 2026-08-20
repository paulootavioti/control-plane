import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function segredoConfigurado(): string {
  const segredo = process.env.CONTROL_PLANE_DIRECTORY_SECRET?.trim();
  if (!segredo || segredo.length < 32) {
    throw new Error("CONTROL_PLANE_DIRECTORY_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return segredo;
}

export function autenticarDiretorio(request: Request, response: Response, next: NextFunction) {
  const recebido = request.header("x-sysbelt-directory-secret") ?? "";
  const esperado = Buffer.from(segredoConfigurado());
  const candidato = Buffer.from(recebido);
  if (candidato.length !== esperado.length || !timingSafeEqual(candidato, esperado)) {
    return response.status(401).json({ mensagem: "Integração não autorizada." });
  }
  return next();
}
