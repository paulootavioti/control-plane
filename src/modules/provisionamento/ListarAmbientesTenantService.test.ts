import { describe, expect, it, vi } from "vitest";

import { ListarAmbientesTenantService } from "./ListarAmbientesTenantService";

describe("listagem do inventário de ambientes tenant", () => {
  it("filtra, pagina e não seleciona material sensível", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      ambienteTenant: { count, findMany },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "ambiente-1" }]),
      $transaction: vi.fn().mockResolvedValue([6, [{
        id: "ambiente-1",
        status: "FALHOU",
        schemaVersaoAtual: "20260801",
        schemaVersaoDesejada: "20260812",
        eventos: [{ status: "FALHOU", tentativas: 5 }],
      }]]),
    };

    const resultado = await new ListarAmbientesTenantService(db as never).execute({
      assinanteId: "assinante-1",
      status: "FALHOU",
      provider: "NEON",
      regiao: "aws-sa-east-1",
      schemaDesatualizado: true,
      pagina: 2,
      limite: 5,
    });

    expect(count).toHaveBeenCalledWith({ where: {
      assinanteId: "assinante-1",
      status: "FALHOU",
      provider: "NEON",
      regiao: "aws-sa-east-1",
      id: { in: ["ambiente-1"] },
    } });
    const consulta = findMany.mock.calls[0][0];
    expect(consulta.skip).toBe(5);
    expect(consulta.take).toBe(5);
    for (const campo of [
      "tenantKey", "secretRef", "chavePublicaIntegracao", "credentialVersion",
      "providerProjectId", "providerBranchId", "providerEndpointId", "databaseName", "roleName",
    ]) {
      expect(consulta.select).not.toHaveProperty(campo);
    }
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(consulta.select.eventos.select).not.toHaveProperty("payload");
    expect(consulta.select.eventos.select).not.toHaveProperty("chaveIdempotencia");
    expect(resultado.itens[0]).toMatchObject({
      schemaDesatualizado: true,
      necessitaAtencao: true,
      retomadaManualDisponivel: true,
      ultimoEvento: { status: "FALHOU", tentativas: 5 },
    });
    expect(resultado.paginacao).toEqual({ pagina: 2, limite: 5, total: 6, totalPaginas: 2 });
  });

  it("filtra ambientes com schema atualizado", async () => {
    const count = vi.fn().mockReturnValue("contagem");
    const findMany = vi.fn().mockReturnValue("consulta");
    const db = {
      ambienteTenant: { count, findMany },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "ambiente-2" }]),
      $transaction: vi.fn().mockResolvedValue([0, []]),
    };

    await new ListarAmbientesTenantService(db as never).execute({
      schemaDesatualizado: false, pagina: 1, limite: 20,
    });

    expect(count).toHaveBeenCalledWith({
      where: { id: { in: ["ambiente-2"] } },
    });
  });
});
