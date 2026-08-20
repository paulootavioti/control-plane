import { describe, expect, it, vi } from "vitest";

import { CancelarFaturaService } from "./CancelarFaturaService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const agora = new Date("2026-08-13T01:00:00.000Z");

function fatura(status = "ABERTA") {
  return {
    id: "f1", assinanteId: "a1", assinaturaId: "ass1", competencia: "2026-08",
    status, totalCentavos: 35000, moeda: "BRL", canceladaEm: status === "CANCELADA" ? agora : null,
  };
}

function banco(status = "ABERTA") {
  const tx = {
    fatura: {
      findUnique: vi.fn().mockResolvedValueOnce(fatura(status)).mockResolvedValue(fatura("CANCELADA")),
      findUniqueOrThrow: vi.fn().mockResolvedValue(fatura("CANCELADA")),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("cancelamento de fatura", () => {
  it.each(["RASCUNHO", "ABERTA"])("cancela fatura %s com motivo e auditoria", async (status) => {
    const { tx, db } = banco(status);

    const resultado = await new CancelarFaturaService(db as never)
      .execute("f1", "Cobrança emitida incorretamente", auditoria, agora);

    expect(resultado).toEqual(expect.objectContaining({ status: "CANCELADA", canceladaEm: agora, duplicado: false }));
    expect(tx.fatura.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: { in: ["RASCUNHO", "ABERTA"] } },
      data: { status: "CANCELADA", canceladaEm: agora },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "FATURA_CANCELADA",
      mudancas: expect.objectContaining({ statusAnterior: status, motivo: "Cobrança emitida incorretamente" }),
    }) });
  });

  it("é idempotente quando já está cancelada", async () => {
    const { tx, db } = banco("CANCELADA");

    const resultado = await new CancelarFaturaService(db as never).execute("f1", "Repetição", auditoria, agora);

    expect(resultado.duplicado).toBe(true);
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it.each(["PAGA", "VENCIDA", "ESTORNADA"])("recusa cancelamento de fatura %s", async (status) => {
    const { tx, db } = banco(status);

    await expect(new CancelarFaturaService(db as never).execute("f1", "Motivo válido", auditoria, agora))
      .rejects.toThrow("FATURA_NAO_CANCELAVEL");
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it("trata cancelamento concorrente como repetição", async () => {
    const { tx, db } = banco();
    tx.fatura.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await new CancelarFaturaService(db as never).execute("f1", "Motivo válido", auditoria, agora);

    expect(resultado.duplicado).toBe(true);
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
