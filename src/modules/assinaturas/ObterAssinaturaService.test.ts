import { describe, expect, it, vi } from "vitest";
import { ObterAssinaturaService } from "./ObterAssinaturaService";

describe("detalhe da assinatura", () => {
  it("retorna histórico comercial limitado com seleção sanitizada", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "a1", status: "ATIVA", faturas: [{ id: "f1", competencia: "2026-08" }],
      _count: { faturas: 15 },
    });
    const resultado = await new ObterAssinaturaService({ assinatura: { findUnique } } as never).execute("a1");
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "a1" });
    expect(consulta.select).not.toHaveProperty("politicaCobranca");
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.faturas.take).toBe(12);
    expect(consulta.select.faturas.select).not.toHaveProperty("gatewayFaturaId");
    expect(consulta.select.faturas.select).not.toHaveProperty("planoSnapshot");
    expect(resultado).toEqual({
      id: "a1", status: "ATIVA", faturas: [{ id: "f1", competencia: "2026-08" }], totalFaturas: 15,
    });
  });

  it("retorna erro uniforme para assinatura ausente", async () => {
    const db = { assinatura: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterAssinaturaService(db as never).execute("a1"))
      .rejects.toThrow("ASSINATURA_NAO_ENCONTRADA");
  });
});
