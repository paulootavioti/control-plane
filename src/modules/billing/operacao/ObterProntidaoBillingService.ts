type AmbienteBilling = Record<string, string | undefined>;

function segredoValido(valor: string | undefined, minimo = 32) {
  return Boolean(valor && valor.length >= minimo);
}

function urlHttpsValida(valor: string | undefined) {
  if (!valor) return false;
  try { return new URL(valor).protocol === "https:"; } catch { return false; }
}

function loteValido(valor: string | undefined) {
  const numero = Number(valor ?? "10");
  return Number.isInteger(numero) && numero >= 1 && numero <= 50;
}

export class ObterProntidaoBillingService {
  execute(ambiente: AmbienteBilling = process.env) {
    const mercadoPago = {
      accessToken: segredoValido(ambiente.MERCADO_PAGO_ACCESS_TOKEN, 20),
      webhookSecret: segredoValido(ambiente.MERCADO_PAGO_WEBHOOK_SECRET),
      backUrlHttps: urlHttpsValida(ambiente.MERCADO_PAGO_BACK_URL),
      webhookUrlHttps: urlHttpsValida(ambiente.MERCADO_PAGO_WEBHOOK_URL),
    };
    const worker = {
      segredoInterno: segredoValido(ambiente.CONTROL_PLANE_WORKER_SECRET),
      loteValido: loteValido(ambiente.BILLING_WORKER_BATCH_SIZE),
      habilitado: ambiente.BILLING_WORKER_ENABLED === "true",
    };
    const entregaHabilitada = ambiente.BILLING_NOTIFICATION_DELIVERY_ENABLED === "true";
    const notificacoes = {
      habilitadas: entregaHabilitada,
      urlHttps: urlHttpsValida(ambiente.BILLING_NOTIFICATION_WEBHOOK_URL),
      token: segredoValido(ambiente.BILLING_NOTIFICATION_WEBHOOK_TOKEN),
    };

    const mercadoPagoPronto = Object.values(mercadoPago).every(Boolean);
    const workerConfigurado = worker.segredoInterno && worker.loteValido;
    const notificacoesProntas = !entregaHabilitada || (notificacoes.urlHttps && notificacoes.token);
    return {
      consultadoEm: new Date(),
      prontoParaHomologacao: mercadoPagoPronto && workerConfigurado && notificacoesProntas,
      prontoParaProducao: mercadoPagoPronto && workerConfigurado && worker.habilitado && notificacoesProntas,
      mercadoPago: { ...mercadoPago, pronto: mercadoPagoPronto },
      worker: { ...worker, configurado: workerConfigurado },
      notificacoes: { ...notificacoes, prontas: notificacoesProntas },
    };
  }
}
