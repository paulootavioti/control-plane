import { describe, expect, it, vi } from "vitest";
import { ObterResumoBillingService } from "./ObterResumoBillingService";

describe("resumo operacional do billing", () => {
  it("agrega filas sem expor conteúdo dos itens", async () => {
    const agora = new Date("2026-08-21T12:00:00Z");
    const recebidoEm = new Date("2026-08-21T10:00:00Z");
    const agendadaPara = new Date("2026-08-20T12:00:00Z");
    const proximaTentativaEm = new Date("2026-08-21T11:00:00Z");
    const db = {
      eventoWebhookPagamento: {
        count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1).mockResolvedValueOnce(2),
        findFirst: vi.fn().mockResolvedValue({ recebidoEm }),
      },
      tentativaDunning: {
        count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(5),
        findFirst: vi.fn().mockResolvedValue({ agendadaPara }),
      },
      notificacaoBilling: {
        count: vi.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(2),
        findFirst: vi.fn().mockResolvedValue({ proximaTentativaEm }),
      },
    };

    const resultado = await new ObterResumoBillingService(db as never).execute(agora);

    expect(resultado).toEqual({
      consultadoEm: agora,
      webhooks: { recebidos: 4, processando: 1, falhos: 2, maisAntigoEm: recebidoEm },
      dunning: { pendentes: 3, executando: 1, falhos: 5, vencidoMaisAntigoEm: agendadaPara },
      notificacoes: { pendentes: 6, falhas: 2, prontaMaisAntigaEm: proximaTentativaEm },
    });
    expect(db.tentativaDunning.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PENDENTE", agendadaPara: { lte: agora } },
    }));
    expect(JSON.stringify(resultado)).not.toContain("payload");
    expect(JSON.stringify(resultado)).not.toContain("destinatario");
  });
});
