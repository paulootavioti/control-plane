import { timingSafeEqual } from "node:crypto";
import { criarInfraestruturaTenantReal } from "../../src/modules/provisionamento/infra/InfraestruturaTenantReal";
import { executarProximo } from "../../src/modules/provisionamento/worker/executarProximo";

function autorizado(recebido: string | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function tamanhoLote(): number {
  const valor = Number(process.env.CONTROL_PLANE_WORKER_BATCH_SIZE ?? "3");
  return Number.isInteger(valor) && valor >= 1 && valor <= 10 ? valor : 3;
}

export async function handler(
  event: { headers: Record<string, string | undefined> },
  executar: typeof executarProximo = executarProximo,
) {
  if (!autorizado(event.headers["x-control-plane-worker-secret"], process.env.CONTROL_PLANE_WORKER_SECRET)) {
    return { statusCode: 401, body: "Não autorizado" };
  }

  if (process.env.PROVISIONAMENTO_REAL_HABILITADO !== "true") {
    return { statusCode: 503, body: "Provisionamento real ainda não configurado" };
  }

  const infraestrutura = criarInfraestruturaTenantReal();
  let processados = 0;
  let filaVazia = false;
  for (let indice = 0; indice < tamanhoLote(); indice += 1) {
    const resultado = await executar(infraestrutura);
    if (resultado === "VAZIO") { filaVazia = true; break; }
    processados += 1;
  }
  return { statusCode: 200, body: JSON.stringify({ processados, filaVazia }) };
}
