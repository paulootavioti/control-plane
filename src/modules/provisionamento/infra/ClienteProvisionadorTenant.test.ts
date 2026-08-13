import { describe, expect, it, vi } from "vitest";
import { ClienteProvisionadorTenant } from "./ClienteProvisionadorTenant";

const evento = {
  id: "e1", ambienteTenantId: "a1", tenantKey: "tenant-1",
  chaveIdempotencia: "criar:tenant-1", etapaAtual: null,
  tipo: "CRIAR_AMBIENTE",
} as const;

describe("cliente do provisionador de tenants", () => {
  it("envia somente referência do segredo e retorna a versão aplicada", async () => {
    const http = vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersaoAtual: "2026081301" }), { status: 200 }));
    const cliente = new ClienteProvisionadorTenant("https://provisionador.test/", "token-interno", http);
    await expect(cliente.aplicarMigrations(evento, "arn:segredo")).resolves.toBe("2026081301");
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://provisionador.test/v1/tenants/operacoes");
    expect(init.headers.authorization).toBe("Bearer token-interno");
    expect(init.headers["x-idempotency-key"]).toContain("APLICAR_MIGRATIONS");
    expect(JSON.parse(init.body)).toEqual({
      operacao: "APLICAR_MIGRATIONS", tenantKey: "tenant-1", secretRef: "arn:segredo",
    });
    expect(init.body).not.toContain("postgresql://");
  });

  it("não inclui corpo remoto potencialmente sensível no erro", async () => {
    const http = vi.fn().mockResolvedValue(new Response("postgresql://usuario:senha@host/db", { status: 500 }));
    await expect(new ClienteProvisionadorTenant("https://provisionador.test", "token", http)
      .validarSaude(evento, "arn:segredo")).rejects.toThrow("status 500");
  });
});
