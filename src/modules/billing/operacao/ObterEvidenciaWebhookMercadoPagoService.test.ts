import { describe, expect, it, vi } from "vitest";
import { ObterEvidenciaWebhookMercadoPagoService } from "./ObterEvidenciaWebhookMercadoPagoService";

describe("evidência de webhook do Mercado Pago", () => {
  it("retorna somente metadados seguros do último evento assinado", async () => {
    const recebidoEm = new Date("2026-08-25T18:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      tipo: "subscription_preapproval", acao: "updated", status: "RECEBIDO", recebidoEm, processadoEm: null,
    });
    const resultado = await new ObterEvidenciaWebhookMercadoPagoService({
      eventoWebhookPagamento: { findFirst },
    } as never).execute();

    expect(resultado).toMatchObject({ homologado: true, assinaturaValidada: true });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { provedor: "MERCADO_PAGO", eventoExternoId: { not: { startsWith: "teste:" } } },
      select: { tipo: true, acao: true, status: true, recebidoEm: true, processadoEm: true },
    }));
    expect(JSON.stringify(resultado)).not.toContain("payloadBruto");
    expect(JSON.stringify(resultado)).not.toContain("eventoExternoId");
  });

  it("informa ausência de evidência sem fabricar evento", async () => {
    const db = { eventoWebhookPagamento: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(new ObterEvidenciaWebhookMercadoPagoService(db as never).execute()).resolves.toEqual({
      homologado: false, assinaturaValidada: false, ultimoEvento: null,
    });
  });
});
