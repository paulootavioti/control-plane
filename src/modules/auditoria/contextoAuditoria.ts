import { Request, Response } from "express";

export interface ContextoAuditoria {
  operadorId: string;
  origem: "OPERADOR";
  ip: string | null;
  userAgent: string | null;
}

export function contextoAuditoria(request: Request, response: Response): ContextoAuditoria {
  return {
    operadorId: response.locals.operador.id,
    origem: "OPERADOR",
    ip: request.ip || null,
    userAgent: request.get("user-agent")?.slice(0, 500) ?? null,
  };
}
