import { describe, expect, it, vi } from "vitest";

import { ClienteNeon, ProjetoNeonEncontradoSemCredenciais } from "./ClienteNeon";

const evento = {
  id: "e1", ambienteTenantId: "a1",
  tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d",
  chaveIdempotencia: "criar:a1", etapaAtual: null,
} as const;

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("cliente Neon", () => {
  it("reconcilia por nome exato e não repete POST", async () => {
    const http = vi.fn().mockResolvedValue(resposta({ projects: [{
      id: "project-1", name: `tenant-${evento.tenantKey}`, pg_version: 16,
    }] }));
    await expect(new ClienteNeon("token", "org-1", "aws-sa-east-1", http).criarOuReconciliar(evento))
      .rejects.toBeInstanceOf(ProjetoNeonEncontradoSemCredenciais);
    expect(http).toHaveBeenCalledOnce();
    expect(http.mock.calls[0][1].method).toBe("GET");
  });

  it("cria projeto somente após busca vazia e separa URLs direct/pooled", async () => {
    const http = vi.fn()
      .mockResolvedValueOnce(resposta({ projects: [] }))
      .mockResolvedValueOnce(resposta({
        project: { id: "project-1", pg_version: 16 }, branch: { id: "branch-1" },
        endpoints: [{ id: "ep-green-river" }], roles: [{ name: "sysbelt_runtime" }],
        databases: [{ name: "sysbelt" }],
        connection_uris: [{ connection_uri: "postgresql://user:pass@ep-green-river.sa-east-1.aws.neon.tech/sysbelt?sslmode=require" }],
      }, 201));
    const resultado = await new ClienteNeon("token", undefined, "aws-sa-east-1", http)
      .criarOuReconciliar(evento);
    expect(resultado.directUrl).toContain("@ep-green-river.");
    expect(resultado.pooledUrl).toContain("@ep-green-river-pooler.");
    expect(http).toHaveBeenCalledTimes(2);
    expect(http.mock.calls[1][1].method).toBe("POST");
  });

  it("não inclui corpo da resposta Neon em erros", async () => {
    const http = vi.fn().mockResolvedValue(resposta({ password: "segredo" }, 401));
    await expect(new ClienteNeon("token", undefined, "aws-sa-east-1", http).criarOuReconciliar(evento))
      .rejects.toThrow("status 401");
  });
});
