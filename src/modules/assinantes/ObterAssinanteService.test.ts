import { describe, expect, it, vi } from "vitest";

import { ObterAssinanteService } from "./ObterAssinanteService";

describe("detalhe administrativo do assinante", () => {
  it("achata assinatura e contagem das faturas sem expor segredos", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "a1",
      nomeFantasia: "Academia Centro",
      ambiente: { id: "amb1", status: "FALHOU", eventos: [
        { id: "ev1", status: "FALHOU", tentativas: 5, erroSanitizado: "Falha segura" },
        { id: "ev2", status: "FALHOU", tentativas: 2, erroSanitizado: "Falha temporária" },
      ] },
      assinaturas: [{ id: "ass1", status: "ATIVA" }],
      faturas: [{ id: "f1", competencia: "2026-08", _count: { itens: 2 } }],
    });
    const resultado = await new ObterAssinanteService({
      assinante: { findUnique },
    } as never).execute("a1");

    expect(resultado.assinatura).toEqual({ id: "ass1", status: "ATIVA" });
    expect(resultado.faturas).toEqual([{ id: "f1", competencia: "2026-08", totalItens: 2 }]);
    expect(resultado.ambiente?.eventos).toEqual([
      expect.objectContaining({ id: "ev1", retomadaManualDisponivel: true }),
      expect.objectContaining({ id: "ev2", retomadaManualDisponivel: false }),
    ]);
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.select.ambiente.select).not.toHaveProperty("secretRef");
    expect(consulta.select.ambiente.select).not.toHaveProperty("chavePublicaIntegracao");
    expect(consulta.select.ambiente.select.eventos).toEqual(expect.objectContaining({ take: 20 }));
    expect(consulta.select.ambiente.select.eventos.select).not.toHaveProperty("payload");
    expect(consulta.select.ambiente.select.eventos.select).not.toHaveProperty("chaveIdempotencia");
    expect(consulta.select.faturas.take).toBe(12);
  });

  it("distingue assinante inexistente", async () => {
    const db = { assinante: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterAssinanteService(db as never).execute("a1"))
      .rejects.toThrow("ASSINANTE_NAO_ENCONTRADO");
  });
});
