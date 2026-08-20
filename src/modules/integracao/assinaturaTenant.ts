import { verify } from "node:crypto";

import { ContagemContratoV1 } from "./contagemContrato";

function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto).sort().map((chave) => `${JSON.stringify(chave)}:${jsonCanonico(objeto[chave])}`).join(",")}}`;
}

export function mensagemAssinada(timestamp: string, payload: ContagemContratoV1): string {
  return `${timestamp}.${jsonCanonico(payload)}`;
}

export function verificarAssinaturaTenant(params: {
  payload: ContagemContratoV1;
  timestamp: string;
  assinaturaBase64: string;
  chavePublica: string;
  agora?: Date;
}): boolean {
  const instante = new Date(params.timestamp);
  const agora = params.agora ?? new Date();
  if (Number.isNaN(instante.getTime()) || Math.abs(agora.getTime() - instante.getTime()) > 5 * 60_000) {
    return false;
  }

  try {
    return verify(
      null,
      Buffer.from(mensagemAssinada(params.timestamp, params.payload)),
      params.chavePublica,
      Buffer.from(params.assinaturaBase64, "base64"),
    );
  } catch {
    return false;
  }
}
