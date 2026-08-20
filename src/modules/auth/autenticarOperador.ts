import { PerfilOperador } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import { prisma } from "../../shared/prisma";
import { verificarToken } from "./regrasAuth";

function segredoJwt(): string {
  const segredo = process.env.CONTROL_PLANE_JWT_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error("CONTROL_PLANE_JWT_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return segredo;
}

export function autenticarOperador(perfis?: PerfilOperador[]) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return response.status(401).json({ mensagem: "Autenticação necessária." });
    }

    try {
      const payload = verificarToken(authorization.slice(7), segredoJwt());
      const operador = await prisma.operadorPlataforma.findUnique({ where: { id: payload.sub } });
      if (!operador?.ativo || operador.versaoToken !== payload.versao) {
        return response.status(401).json({ mensagem: "Sessão inválida." });
      }
      if (perfis && !perfis.includes(operador.perfil)) {
        return response.status(403).json({ mensagem: "Permissão insuficiente." });
      }
      response.locals.operador = operador;
      return next();
    } catch {
      return response.status(401).json({ mensagem: "Sessão inválida." });
    }
  };
}

export { segredoJwt };
