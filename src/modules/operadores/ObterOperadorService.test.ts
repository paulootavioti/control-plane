import { describe, expect, it, vi } from "vitest";
import { ObterOperadorService } from "./ObterOperadorService";

describe("detalhe do operador", () => {
  it("retorna perfil e atividade recente sem dados de autenticação", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "o1", nome: "Suporte", email: "suporte@sysbelt.test",
      auditorias: [{ id: "log1", acao: "ASSINANTE_ATUALIZADO" }],
      _count: { auditorias: 27 },
    });
    const resultado = await new ObterOperadorService({ operadorPlataforma: { findUnique } } as never).execute("o1");
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "o1" });
    expect(consulta.select).not.toHaveProperty("senhaHash");
    expect(consulta.select).not.toHaveProperty("versaoToken");
    expect(consulta.select.auditorias.take).toBe(20);
    expect(consulta.select.auditorias.select).not.toHaveProperty("mudancas");
    expect(consulta.select.auditorias.select).not.toHaveProperty("ip");
    expect(resultado).toEqual({
      id: "o1", nome: "Suporte", email: "suporte@sysbelt.test",
      auditorias: [{ id: "log1", acao: "ASSINANTE_ATUALIZADO" }], totalAcoesAuditadas: 27,
    });
  });

  it("retorna erro uniforme para operador ausente", async () => {
    const db = { operadorPlataforma: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterOperadorService(db as never).execute("o1"))
      .rejects.toThrow("OPERADOR_NAO_ENCONTRADO");
  });
});
