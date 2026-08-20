import { describe, expect, it, vi } from "vitest";
import { ObterEventoProvisionamentoService } from "./ObterEventoProvisionamentoService";

describe("detalhe do evento de provisionamento", () => {
  it("retorna diagnóstico sanitizado e disponibilidade de retomada", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "e1", status: "FALHOU", tentativas: 5,
      ambiente: { id: "amb1", tenantKey: "tenant-1", assinante: { id: "a1", nomeFantasia: "Academia" } },
    });
    const resultado = await new ObterEventoProvisionamentoService({ eventoProvisionamento: { findUnique } } as never).execute("e1");
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "e1" });
    expect(consulta.select).not.toHaveProperty("payload");
    expect(consulta.select).not.toHaveProperty("chaveIdempotencia");
    expect(consulta.select.ambiente.select).not.toHaveProperty("secretRef");
    expect(consulta.select.ambiente.select).not.toHaveProperty("providerProjectId");
    expect(consulta.select.ambiente.select.assinante.select).not.toHaveProperty("documento");
    expect(resultado.retomadaManualDisponivel).toBe(true);
  });

  it("retorna erro uniforme para evento ausente", async () => {
    const db = { eventoProvisionamento: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterEventoProvisionamentoService(db as never).execute("e1"))
      .rejects.toThrow("EVENTO_NAO_ENCONTRADO");
  });
});
