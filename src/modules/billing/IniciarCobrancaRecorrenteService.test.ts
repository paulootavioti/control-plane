import { describe, expect, it, vi } from "vitest";
import { IniciarCobrancaRecorrenteService } from "./IniciarCobrancaRecorrenteService";

describe("IniciarCobrancaRecorrenteService", () => {
  it("vincula cliente e assinatura remotos usando chaves idempotentes", async () => {
    const db = {
      assinatura: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ass-1", status: "ATIVA", produtoCodigo: "mecanix",
          gatewayClienteId: null, gatewayAssinaturaId: null,
          assinante: { nomeFantasia: "Oficina Centro", emailCobranca: "financeiro@example.com" },
        }),
        update: vi.fn(),
      },
    };
    const provedor = {
      nome: "FAKE",
      criarCliente: vi.fn().mockResolvedValue({ id: "cus-1" }),
      criarAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "pending", referenciaExterna: "ass-1", checkoutUrl: "https://checkout" }),
    };
    const resultado = await new IniciarCobrancaRecorrenteService(db as never, provedor as never).execute("ass-1", {
      valorCentavos: 19900, meioPagamento: "CARTAO", inicioEm: new Date("2026-09-01T12:00:00Z"),
    });
    expect(provedor.criarCliente).toHaveBeenCalledWith(expect.anything(), "cliente:ass-1:v1");
    expect(provedor.criarAssinatura).toHaveBeenCalledWith(expect.objectContaining({
      clienteId: "cus-1", pagadorEmail: "financeiro@example.com", valorCentavos: 19900,
    }), "assinatura:ass-1:v1");
    expect(db.assinatura.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gatewayAssinaturaId: "sub-1" }),
    }));
    expect(resultado).toMatchObject({ existente: false, checkoutUrl: "https://checkout" });
  });

  it("não duplica assinatura já vinculada", async () => {
    const db = { assinatura: { findUnique: vi.fn().mockResolvedValue({
      id: "ass-1", status: "ATIVA", gatewayAssinaturaId: "sub-1",
    }) } };
    const provedor = { criarCliente: vi.fn(), criarAssinatura: vi.fn() };
    const resultado = await new IniciarCobrancaRecorrenteService(db as never, provedor as never).execute("ass-1", {
      valorCentavos: 1000, meioPagamento: "PIX", inicioEm: new Date(),
    });
    expect(resultado.existente).toBe(true);
    expect(provedor.criarAssinatura).not.toHaveBeenCalled();
  });
});
