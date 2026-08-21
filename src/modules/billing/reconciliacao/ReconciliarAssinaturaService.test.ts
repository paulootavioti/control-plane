import { describe, expect, it, vi } from "vitest";
import { ReconciliarAssinaturaService } from "./ReconciliarAssinaturaService";

describe("ReconciliarAssinaturaService", () => {
  it("corrige divergência local usando o estado do PSP", async () => {
    const tx = {
      assinatura: { update: vi.fn() },
      tentativaDunning: { updateMany: vi.fn() },
      tenantProduto: { updateMany: vi.fn() },
    };
    const db = {
      assinatura: { findUnique: vi.fn().mockResolvedValue({
        id: "ass-1", assinanteId: "cli-1", produtoCodigo: "psyche",
        status: "INADIMPLENTE", gatewayAssinaturaId: "sub-1",
      }) },
      $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx),
    };
    const provedor = { obterAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "authorized", referenciaExterna: "ass-1" }) };
    const resultado = await new ReconciliarAssinaturaService(db as never, provedor as never).execute("ass-1");
    expect(resultado).toMatchObject({ alterada: true, status: "ATIVA" });
    expect(tx.tentativaDunning.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELADA" } }));
    expect(tx.tenantProduto.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ produtoCodigo: "psyche", status: "SUSPENSO_FINANCEIRO" }),
      data: { status: "ATIVO" },
    }));
  });
});
