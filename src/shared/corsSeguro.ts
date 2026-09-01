import { NextFunction, Request, Response } from "express";

function normalizarOrigem(valor: string): string | null {
  try {
    const url = new URL(valor);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function origensCorsConfiguradas(ambiente: NodeJS.ProcessEnv = process.env): Set<string> {
  const origens = (ambiente.CONTROL_PLANE_CORS_ORIGINS ?? "")
    .split(",")
    .map((item) => normalizarOrigem(item.trim()))
    .filter((item): item is string => Boolean(item));
  if (ambiente.NODE_ENV === "development") origens.push("http://localhost:5177");
  return new Set(origens);
}

export function origemCorsPermitida(origem: string, origemDaApi: string, ambiente: NodeJS.ProcessEnv = process.env) {
  const normalizada = normalizarOrigem(origem);
  const api = normalizarOrigem(origemDaApi);
  return Boolean(normalizada && api && (normalizada === api || origensCorsConfiguradas(ambiente).has(normalizada)));
}

export function restringirCors(request: Request, response: Response, next: NextFunction) {
  const origem = request.get("origin");
  if (!origem) return next();
  const host = request.get("host");
  const origemDaApi = host ? `${request.protocol}://${host}` : "";
  if (!origemCorsPermitida(origem, origemDaApi)) {
    return response.status(403).json({ codigo: "ORIGEM_NAO_PERMITIDA" });
  }
  return next();
}
