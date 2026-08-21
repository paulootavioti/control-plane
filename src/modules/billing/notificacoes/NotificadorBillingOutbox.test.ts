import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { NotificadorBillingOutbox } from "./NotificadorBillingOutbox";

const dados = {
  assinaturaId: "ass-1", destinatario: "financeiro@example.com",
  tipo: "PAGAMENTO_FALHOU" as const, diaRegua: 0, produtoCodigo: "psyche",
};

describe("NotificadorBillingOutbox", () => {
  it("cria notificação com chave idempotente", async () => {
    const create = vi.fn();
    expect(await new NotificadorBillingOutbox({ notificacaoBilling: { create } } as never).enfileirar(dados))
      .toEqual({ criada: true });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ chaveIdempotencia: "ass-1:PAGAMENTO_FALHOU:d0" }) });
  });

  it("aceita reexecução sem duplicar", async () => {
    const erro = new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "6" });
    const db = { notificacaoBilling: { create: vi.fn().mockRejectedValue(erro) } };
    expect(await new NotificadorBillingOutbox(db as never).enfileirar(dados)).toEqual({ criada: false });
  });
});
