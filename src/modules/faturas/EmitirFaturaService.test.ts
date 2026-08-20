import { describe, expect, it, vi } from "vitest";

import { EmitirFaturaService } from "./EmitirFaturaService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const agora = new Date("2026-08-12T20:00:00.000Z");

function fatura(status = "RASCUNHO") {
  return {
    id: "f1", assinanteId: "a1", assinaturaId: "ass1", competencia: "2026-08",
    vencimentoEm: new Date("2026-08-10T00:00:00.000Z"), status,
    totalCentavos: 35000, moeda: "BRL", emitidaEm: status === "ABERTA" ? agora : null,
  };
}

function banco(status = "RASCUNHO") {
  const tx = {
    fatura: {
      findUnique: vi.fn()
        .mockResolvedValueOnce(fatura(status))
        .mockResolvedValue(fatura("ABERTA")),
      findUniqueOrThrow: vi.fn().mockResolvedValue(fatura("ABERTA")),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("emissão de fatura", () => {
  it("abre o rascunho e audita na mesma transação", async () => {
    const { tx, db } = banco();

    const resultado = await new EmitirFaturaService(db as never).execute("f1", auditoria, agora);

    expect(resultado).toEqual(expect.objectContaining({ status: "ABERTA", emitidaEm: agora, duplicado: false }));
    expect(tx.fatura.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: "RASCUNHO" },
      data: { status: "ABERTA", emitidaEm: agora },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "FATURA_EMITIDA", alvoId: "f1",
      mudancas: {
        statusAnterior: "RASCUNHO", statusAtual: "ABERTA",
        competencia: "2026-08", totalCentavos: 35000,
      },
    }) });
  });

  it("é idempotente quando a fatura já está aberta", async () => {
    const { tx, db } = banco("ABERTA");

    const resultado = await new EmitirFaturaService(db as never).execute("f1", auditoria, agora);

    expect(resultado.duplicado).toBe(true);
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });

  it("recusa emissão após transição para estado final", async () => {
    const { tx, db } = banco("CANCELADA");

    await expect(new EmitirFaturaService(db as never).execute("f1", auditoria, agora))
      .rejects.toThrow("FATURA_NAO_EMITIVEL");
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it("trata emissão concorrente como repetição idempotente", async () => {
    const { tx, db } = banco();
    tx.fatura.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await new EmitirFaturaService(db as never).execute("f1", auditoria, agora);

    expect(resultado.duplicado).toBe(true);
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
