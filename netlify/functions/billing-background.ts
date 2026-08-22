import { timingSafeEqual } from "node:crypto";
import { executarCicloBillingRegistrado } from "../../src/modules/billing/worker/executarCicloBillingRegistrado";

function autorizado(recebido: string | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function tamanhoLote(): number {
  const valor = Number(process.env.BILLING_WORKER_BATCH_SIZE ?? "10");
  return Number.isInteger(valor) && valor >= 1 && valor <= 50 ? valor : 10;
}

export async function handler(
  event: { headers: Record<string, string | undefined> },
  executar: typeof executarCicloBillingRegistrado = executarCicloBillingRegistrado,
) {
  if (!autorizado(event.headers["x-control-plane-worker-secret"], process.env.CONTROL_PLANE_WORKER_SECRET)) {
    return { statusCode: 401, body: "Não autorizado" };
  }
  if (process.env.BILLING_WORKER_ENABLED !== "true") {
    return { statusCode: 503, body: "Worker de billing ainda não habilitado" };
  }
  const resultado = await executar(undefined, undefined, tamanhoLote());
  return { statusCode: 200, body: JSON.stringify(resultado) };
}
