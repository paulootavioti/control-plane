import { describe, expect, it, vi } from "vitest";
import { ObterAuditoriaService } from "./ObterAuditoriaService";

describe("detalhe da auditoria", () => {
  it("retorna contexto investigativo com relações sanitizadas", async () => {
    const registro = { id: "log1", acao: "ASSINANTE_ATUALIZADO", mudancas: { nome: { de: "A", para: "B" } } };
    const findUnique = vi.fn().mockResolvedValue(registro);
    const resultado = await new ObterAuditoriaService({ auditLogPlataforma: { findUnique } } as never).execute("log1");
    const consulta = findUnique.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "log1" });
    expect(consulta.select.operador.select).not.toHaveProperty("email");
    expect(consulta.select.operador.select).not.toHaveProperty("senhaHash");
    expect(consulta.select.assinante.select).not.toHaveProperty("documento");
    expect(consulta.select.assinante.select).not.toHaveProperty("emailCobranca");
    expect(resultado).toEqual(registro);
  });

  it("retorna erro uniforme para registro ausente", async () => {
    const db = { auditLogPlataforma: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterAuditoriaService(db as never).execute("log1"))
      .rejects.toThrow("AUDITORIA_NAO_ENCONTRADA");
  });
});
