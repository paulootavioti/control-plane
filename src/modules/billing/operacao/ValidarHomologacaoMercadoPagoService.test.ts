import { describe, expect, it, vi } from "vitest";
import { ValidarHomologacaoMercadoPagoService } from "./ValidarHomologacaoMercadoPagoService";

const auditoria = { operadorId: "00000000-0000-0000-0000-000000000001", origem: "OPERADOR" as const, ip: null, userAgent: null };

describe("ValidarHomologacaoMercadoPagoService", () => {
  it("valida sem expor a conta e registra somente metadados seguros", async () => {
    const create = vi.fn().mockResolvedValue({});
    const provedor = { validarCredencial: vi.fn().mockResolvedValue({ contaId: "123456", siteId: "MLB", ativa: true }) };
    const agora = new Date("2026-08-24T13:00:00.000Z");

    await expect(new ValidarHomologacaoMercadoPagoService({ auditLogPlataforma: { create } } as never, provedor)
      .execute(auditoria, agora)).resolves.toEqual({ valido: true, siteId: "MLB", verificadoEm: agora });
    expect(create.mock.calls[0][0].data.mudancas).toEqual({
      resultado: "SUCESSO", siteId: "MLB", codigo: undefined, verificadoEm: agora.toISOString(),
    });
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain("123456");
  });

  it("sanitiza e audita a falha do PSP", async () => {
    const create = vi.fn().mockResolvedValue({});
    const provedor = { validarCredencial: vi.fn().mockRejectedValue(new Error("socket com token secreto")) };
    await expect(new ValidarHomologacaoMercadoPagoService({ auditLogPlataforma: { create } } as never, provedor)
      .execute(auditoria)).rejects.toThrow("MERCADO_PAGO_INDISPONIVEL");
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain("token secreto");
  });
});
