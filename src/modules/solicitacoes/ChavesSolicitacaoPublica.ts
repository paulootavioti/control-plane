import { timingSafeEqual } from "node:crypto";

function chaves(): Record<string, string> {
  try {
    const valor = JSON.parse(process.env.CONTROL_PLANE_SUBSCRIPTION_REQUEST_KEYS ?? "{}") as unknown;
    return valor && typeof valor === "object" ? valor as Record<string, string> : {};
  } catch { return {}; }
}

export function validarChavePublica(produtoId: string, recebida?: string): boolean {
  const esperada = chaves()[produtoId];
  if (!esperada || !recebida) return false;
  const a = Buffer.from(esperada);
  const b = Buffer.from(recebida);
  return a.length === b.length && timingSafeEqual(a, b);
}
