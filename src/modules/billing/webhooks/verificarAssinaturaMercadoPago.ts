import { createHmac, timingSafeEqual } from "node:crypto";

export interface CabecalhosWebhookMercadoPago {
  assinatura: string;
  requestId: string;
  dataId: string;
}

function partesAssinatura(valor: string): { ts: string; v1: string } {
  const partes = Object.fromEntries(valor.split(",").map((item) => {
    const [chave, conteudo] = item.trim().split("=", 2);
    return [chave, conteudo];
  }));
  if (!partes.ts || !partes.v1) throw new Error("ASSINATURA_WEBHOOK_MALFORMADA");
  return { ts: partes.ts, v1: partes.v1 };
}

export function verificarAssinaturaMercadoPago(
  cabecalhos: CabecalhosWebhookMercadoPago,
  segredo: string,
  agoraEmSegundos = Math.floor(Date.now() / 1000),
): void {
  if (segredo.length < 16) throw new Error("SEGREDO_WEBHOOK_INVALIDO");
  const { ts, v1 } = partesAssinatura(cabecalhos.assinatura);
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp) || Math.abs(agoraEmSegundos - timestamp) > 300) {
    throw new Error("ASSINATURA_WEBHOOK_EXPIRADA");
  }
  const manifesto = `id:${cabecalhos.dataId};request-id:${cabecalhos.requestId};ts:${ts};`;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(manifesto).digest("hex"));
  const recebido = Buffer.from(v1);
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    throw new Error("ASSINATURA_WEBHOOK_INVALIDA");
  }
}

export function chaveEventoMercadoPago(tipo: string, acao: string, dataId: string): string {
  return `${tipo}:${acao}:${dataId}`;
}
