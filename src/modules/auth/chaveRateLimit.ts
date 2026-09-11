import { isIP } from "node:net";
import type { Request } from "express";

export function chaveRateLimit(request: Request): string {
  const netlify = request.header("x-nf-client-connection-ip")?.trim();
  if (netlify && isIP(netlify)) return netlify;
  const socket = request.socket.remoteAddress?.trim();
  if (socket && isIP(socket)) return socket;
  return "cliente-sem-ip";
}
