import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from "./billing-background";

describe("billing-background", () => {
  afterEach(() => {
    delete process.env.CONTROL_PLANE_WORKER_SECRET;
    delete process.env.BILLING_WORKER_ENABLED;
    delete process.env.BILLING_WORKER_BATCH_SIZE;
  });

  it("exige segredo interno", async () => {
    process.env.CONTROL_PLANE_WORKER_SECRET = "s".repeat(32);
    expect((await handler({ headers: {} }, vi.fn())).statusCode).toBe(401);
  });

  it("executa lote configurado quando habilitado", async () => {
    process.env.CONTROL_PLANE_WORKER_SECRET = "s".repeat(32);
    process.env.BILLING_WORKER_ENABLED = "true";
    process.env.BILLING_WORKER_BATCH_SIZE = "7";
    const executar = vi.fn().mockResolvedValue({ eventos: 1, dunning: 2, reconciliacoes: 3, falhas: 0 });
    const resposta = await handler({ headers: { "x-control-plane-worker-secret": "s".repeat(32) } }, executar);
    expect(executar).toHaveBeenCalledWith(undefined, undefined, 7);
    expect(resposta.statusCode).toBe(200);
  });
});
