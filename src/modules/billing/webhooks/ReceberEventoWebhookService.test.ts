import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ReceberEventoWebhookService } from "./ReceberEventoWebhookService";

describe("ReceberEventoWebhookService", () => {
  const evento = {
    eventoExternoId: "subscription_preapproval:updated:sub-1",
    tipo: "subscription_preapproval",
    acao: "updated",
    payloadBruto: { data: { id: "sub-1" } },
  };

  it("persiste o payload bruto antes de qualquer processamento", async () => {
    const create = vi.fn().mockResolvedValue({ id: "evt-1", status: "RECEBIDO" });
    const resultado = await new ReceberEventoWebhookService({
      eventoWebhookPagamento: { create },
    } as never).execute(evento);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ provedor: "MERCADO_PAGO", payloadBruto: evento.payloadBruto }),
    }));
    expect(resultado.novo).toBe(true);
  });

  it("trata reenvio como idempotente", async () => {
    const duplicado = new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "6" });
    const db = {
      eventoWebhookPagamento: {
        create: vi.fn().mockRejectedValue(duplicado),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "evt-1", status: "PROCESSADO" }),
      },
    };
    const resultado = await new ReceberEventoWebhookService(db as never).execute(evento);
    expect(resultado).toEqual({ id: "evt-1", status: "PROCESSADO", novo: false });
  });
});
