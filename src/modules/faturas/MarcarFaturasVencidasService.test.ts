import { describe, expect, it, vi } from "vitest";

import { MarcarFaturasVencidasService } from "./MarcarFaturasVencidasService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const agora = new Date("2026-08-13T03:00:00.000Z");
const candidata = (id: string) => ({
  id, assinanteId: `a-${id}`, assinaturaId: `ass-${id}`,
  competencia: "2026-08", vencimentoEm: new Date("2026-08-10T00:00:00.000Z"),
  totalCentavos: 35000,
});

function banco(candidatas = [candidata("f1")]) {
  const tx = {
    fatura: {
      findMany: vi.fn().mockResolvedValue(candidatas),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("marcação de faturas vencidas", () => {
  it("processa lote ordenado e audita cada transição", async () => {
    const { tx, db } = banco([candidata("f1"), candidata("f2")]);

    const resultado = await new MarcarFaturasVencidasService(db as never).execute(auditoria, agora, 100);

    expect(resultado).toEqual({ processadas: 2, faturasIds: ["f1", "f2"], possuiMais: false });
    expect(tx.fatura.findMany).toHaveBeenCalledWith({
      where: { status: "ABERTA", vencimentoEm: { lt: agora } },
      orderBy: [{ vencimentoEm: "asc" }, { id: "asc" }],
      take: 100,
      select: expect.any(Object),
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "FATURA_MARCADA_VENCIDA", alvoId: "f1",
    }) });
  });

  it("é idempotente quando não há candidatas", async () => {
    const { tx, db } = banco([]);
    const resultado = await new MarcarFaturasVencidasService(db as never).execute(auditoria, agora);
    expect(resultado).toEqual({ processadas: 0, faturasIds: [], possuiMais: false });
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it("ignora fatura alterada concorrentemente", async () => {
    const { tx, db } = banco();
    tx.fatura.updateMany.mockResolvedValue({ count: 0 });
    const resultado = await new MarcarFaturasVencidasService(db as never).execute(auditoria, agora);
    expect(resultado.processadas).toBe(0);
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });

  it("sinaliza continuação quando o lote atinge o limite", async () => {
    const { db } = banco([candidata("f1"), candidata("f2")]);
    const resultado = await new MarcarFaturasVencidasService(db as never).execute(auditoria, agora, 2);
    expect(resultado.possuiMais).toBe(true);
  });
});
