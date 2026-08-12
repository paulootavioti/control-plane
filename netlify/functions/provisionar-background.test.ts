import { describe, expect, it } from "vitest";

import { handler } from "./provisionar-background";

describe("Background Function de provisionamento", () => {
  it("recusa chamada sem segredo interno", async () => {
    process.env.CONTROL_PLANE_WORKER_SECRET = "segredo-interno-de-teste-com-32-caracteres";
    const resposta = await handler({ headers: {} });
    expect(resposta.statusCode).toBe(401);
  });

  it("não adquire eventos enquanto provisionamento real está desabilitado", async () => {
    process.env.CONTROL_PLANE_WORKER_SECRET = "segredo-interno-de-teste-com-32-caracteres";
    process.env.PROVISIONAMENTO_REAL_HABILITADO = "false";
    const resposta = await handler({
      headers: { "x-control-plane-worker-secret": process.env.CONTROL_PLANE_WORKER_SECRET },
    });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.body).toContain("ainda não configurado");
  });
});
