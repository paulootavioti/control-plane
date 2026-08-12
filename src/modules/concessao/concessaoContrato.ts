import { sign } from "node:crypto";
import { z } from "zod";

const RECURSOS = ["WHATSAPP", "GATEWAY_AUTOMATICO", "CONTROLE_ACESSO"] as const;
export type RecursoConcessao = (typeof RECURSOS)[number];

export type PayloadConcessaoV1 = {
  versao: 1;
  tenantKey: string;
  revisao: number;
  statusAcesso: "ATIVO" | "SUSPENSO" | "CANCELADO";
  recursos: RecursoConcessao[];
  emitidaEm: string;
  expiraEm: string;
};

function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto).sort().map((chave) => `${JSON.stringify(chave)}:${jsonCanonico(objeto[chave])}`).join(",")}}`;
}

export function assinarConcessao(payload: PayloadConcessaoV1, chavePrivadaPem: string) {
  return {
    ...payload,
    assinatura: sign(null, Buffer.from(jsonCanonico(payload)), chavePrivadaPem).toString("base64"),
  };
}

export function extrairRecursos(recursos: unknown): RecursoConcessao[] {
  const catalogo = z.record(z.string(), z.boolean()).parse(recursos);
  return RECURSOS.filter((recurso) => catalogo[recurso] === true);
}

export function statusAcesso(status: string): PayloadConcessaoV1["statusAcesso"] {
  if (["TESTE", "ATIVA", "INADIMPLENTE"].includes(status)) return "ATIVO";
  if (status === "SUSPENSA") return "SUSPENSO";
  return "CANCELADO";
}
