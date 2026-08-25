import { describe, expect, it } from "vitest";
import { ObterProntidaoBillingService } from "./ObterProntidaoBillingService";

const base = {
  MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-" + "x".repeat(32),
  MERCADO_PAGO_WEBHOOK_SECRET: "w".repeat(32),
  MERCADO_PAGO_BACK_URL: "https://control.example.com/billing/retorno",
  MERCADO_PAGO_WEBHOOK_URL: "https://control.example.com/api/billing/webhooks/mercado-pago",
  CONTROL_PLANE_WORKER_SECRET: "s".repeat(32),
  BILLING_WORKER_BATCH_SIZE: "10",
  BILLING_WORKER_ENABLED: "false",
  BILLING_NOTIFICATION_DELIVERY_ENABLED: "false",
};

describe("prontidão do billing", () => {
  it("distingue homologação preparada de produção habilitada", () => {
    const resultado = new ObterProntidaoBillingService().execute(base);
    expect(resultado.prontoParaHomologacao).toBe(true);
    expect(resultado.prontoParaProducao).toBe(false);
    expect(resultado.worker).toMatchObject({ configurado: true, habilitado: false });
    expect(JSON.stringify(resultado)).not.toContain(base.MERCADO_PAGO_ACCESS_TOKEN);
    expect(JSON.stringify(resultado)).not.toContain(base.CONTROL_PLANE_WORKER_SECRET);
  });

  it("exige HTTPS, segredos mínimos e lote válido", () => {
    const resultado = new ObterProntidaoBillingService().execute({
      ...base, MERCADO_PAGO_WEBHOOK_SECRET: "curto", MERCADO_PAGO_BACK_URL: "http://inseguro.example.com",
      MERCADO_PAGO_WEBHOOK_URL: "http://inseguro.example.com/webhook",
      CONTROL_PLANE_WORKER_SECRET: "curto", BILLING_WORKER_BATCH_SIZE: "99",
    });
    expect(resultado.prontoParaHomologacao).toBe(false);
    expect(resultado.mercadoPago).toMatchObject({
      webhookSecret: false, backUrlHttps: false, webhookUrlHttps: false, pronto: false,
    });
    expect(resultado.worker).toMatchObject({ segredoInterno: false, loteValido: false, configurado: false });
  });

  it("não bloqueia pelo transporte opcional desligado e valida quando ligado", () => {
    expect(new ObterProntidaoBillingService().execute(base).notificacoes.prontas).toBe(true);
    const invalido = new ObterProntidaoBillingService().execute({ ...base, BILLING_NOTIFICATION_DELIVERY_ENABLED: "true" });
    expect(invalido.notificacoes.prontas).toBe(false);
    const valido = new ObterProntidaoBillingService().execute({
      ...base, BILLING_NOTIFICATION_DELIVERY_ENABLED: "true",
      BILLING_NOTIFICATION_WEBHOOK_URL: "https://notify.example.com", BILLING_NOTIFICATION_WEBHOOK_TOKEN: "n".repeat(32),
    });
    expect(valido.notificacoes.prontas).toBe(true);
  });
});
