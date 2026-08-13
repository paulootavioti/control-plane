import { afterEach, describe, expect, it, vi } from "vitest";

import { handler } from "./provisionar-background";

describe("Background Function de provisionamento", () => {
  afterEach(() => { process.env.PROVISIONAMENTO_REAL_HABILITADO = "false"; });
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

  it("executa um evento quando a infraestrutura real está explicitamente configurada", async () => {
    process.env.CONTROL_PLANE_WORKER_SECRET = "segredo-interno-de-teste-com-32-caracteres";
    process.env.PROVISIONAMENTO_REAL_HABILITADO = "true";
    process.env.NEON_API_KEY = "neon-token";
    process.env.NEON_REGION_ID = "aws-sa-east-1";
    process.env.AWS_REGION = "sa-east-1";
    process.env.TENANT_PROVISIONER_URL = "https://provisionador.test";
    process.env.TENANT_PROVISIONER_TOKEN = "token-provisionador";
    const executar = vi.fn().mockResolvedValue("VAZIO");
    const resposta = await handler({
      headers: { "x-control-plane-worker-secret": process.env.CONTROL_PLANE_WORKER_SECRET },
    }, executar);
    expect(executar).toHaveBeenCalledOnce();
    expect(resposta).toEqual({ statusCode: 200, body: JSON.stringify({ resultado: "VAZIO" }) });
  });
});
