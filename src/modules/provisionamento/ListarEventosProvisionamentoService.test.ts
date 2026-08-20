import { describe, expect, it, vi } from "vitest";

import { ListarEventosProvisionamentoService } from "./ListarEventosProvisionamentoService";

describe("listagem global dos eventos de provisionamento", () => {
  it("filtra, pagina e não seleciona material sensível", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      eventoProvisionamento: { count, findMany },
      $transaction: vi.fn().mockResolvedValue([6, [
        { id: "evento-1", status: "FALHOU", tentativas: 5 },
        { id: "evento-2", status: "EXECUTANDO", tentativas: 2 },
      ]]),
    };
    const inicio = new Date("2026-08-01T00:00:00.000Z");
    const fim = new Date("2026-08-31T23:59:59.999Z");

    const resultado = await new ListarEventosProvisionamentoService(db as never).execute({
      assinanteId: "assinante-1", status: "FALHOU", tipo: "CRIAR_AMBIENTE",
      inicio, fim, pagina: 2, limite: 5,
    });

    expect(count).toHaveBeenCalledWith({ where: {
      ambiente: { assinanteId: "assinante-1" }, status: "FALHOU",
      tipo: "CRIAR_AMBIENTE", criadoEm: { gte: inicio, lte: fim },
    } });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(5);
    expect(consulta.take).toBe(5);
    expect(consulta.select).not.toHaveProperty("payload");
    expect(consulta.select).not.toHaveProperty("chaveIdempotencia");
    expect(consulta.select.ambiente.select).not.toHaveProperty("secretRef");
    expect(consulta.select.ambiente.select).not.toHaveProperty("chavePublicaIntegracao");
    expect(consulta.select.ambiente.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.ambiente.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(resultado.itens[0].retomadaManualDisponivel).toBe(true);
    expect(resultado.itens[1].retomadaManualDisponivel).toBe(false);
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 5, total: 6, totalPaginas: 2 });
  });
});
