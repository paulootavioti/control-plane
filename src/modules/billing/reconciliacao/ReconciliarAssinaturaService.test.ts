import { describe, expect, it, vi } from "vitest";
import { ReconciliarAssinaturaService } from "./ReconciliarAssinaturaService";

describe("ReconciliarAssinaturaService", () => {
  it("corrige divergência local usando o estado do PSP", async () => {
    const db = {
      assinatura: {
        findUnique: vi.fn().mockResolvedValue({ id: "ass-1", status: "INADIMPLENTE", gatewayAssinaturaId: "sub-1" }),
        update: vi.fn(),
      },
      tentativaDunning: { updateMany: vi.fn() },
    };
    const provedor = { obterAssinatura: vi.fn().mockResolvedValue({ id: "sub-1", status: "authorized", referenciaExterna: "ass-1" }) };
    const resultado = await new ReconciliarAssinaturaService(db as never, provedor as never).execute("ass-1");
    expect(resultado).toMatchObject({ alterada: true, status: "ATIVA" });
    expect(db.tentativaDunning.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELADA" } }));
  });
});
