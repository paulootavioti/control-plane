import { describe, expect, it, vi } from "vitest";

import { ObterLicencaUnidadeService } from "./ObterLicencaUnidadeService";

describe("detalhe da licença de unidade", () => {
  it("retorna dados sanitizados e até doze contagens agregadas recentes", async () => {
    const licenca = {
      id: "l1", tenantUnidadeId: "u1", nomeExibicao: "Centro", status: "ATIVA",
      inicioCobrancaEm: new Date(), encerramentoCobrancaEm: null, ultimaSincronizacaoEm: new Date(),
      criadoEm: new Date(), atualizadoEm: new Date(),
      assinante: { id: "a1", nomeFantasia: "Academia", slug: "academia", status: "ATIVA" },
      contagens: [{ alunosAtivos: 42, snapshot: {
        id: "s1", eventoExternoId: "evento-1", versaoContrato: 1,
        dataCorte: new Date(), recebidoEm: new Date(),
      } }],
    };
    const findUnique = vi.fn().mockResolvedValue(licenca);

    const resultado = await new ObterLicencaUnidadeService({ licencaUnidade: { findUnique } } as never)
      .execute("l1");

    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "l1" });
    expect(consulta.select.assinante.select).toEqual({
      id: true, nomeFantasia: true, slug: true, status: true,
    });
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(consulta.select.contagens.take).toBe(12);
    expect(consulta.select.contagens.select).toEqual({
      alunosAtivos: true,
      snapshot: { select: {
        id: true, eventoExternoId: true, versaoContrato: true, dataCorte: true, recebidoEm: true,
      } },
    });
    expect(JSON.stringify(consulta.select)).not.toMatch(/documento|email|segredo|credencial/i);
    expect(resultado).toBe(licenca);
  });

  it("retorna erro quando a licença não existe", async () => {
    const db = { licencaUnidade: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterLicencaUnidadeService(db as never).execute("l1"))
      .rejects.toThrow("LICENCA_NAO_ENCONTRADA");
  });
});
