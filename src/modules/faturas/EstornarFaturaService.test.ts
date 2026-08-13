import { describe, expect, it, vi } from "vitest";

import { EstornarFaturaService } from "./EstornarFaturaService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const agora = new Date("2026-08-13T03:00:00.000Z");

function fatura(status = "PAGA") {
  return {
    id: "f1", assinanteId: "a1", assinaturaId: "ass1", competencia: "2026-08",
    status, totalCentavos: 35000, moeda: "BRL", gateway: "MANUAL",
    gatewayFaturaId: "rec-1", pagaEm: new Date("2026-08-12T20:00:00.000Z"),
    estornadaEm: status === "ESTORNADA" ? agora : null,
  };
}

function banco(status = "PAGA") {
  const tx = {
    fatura: {
      findUnique: vi.fn().mockResolvedValueOnce(fatura(status)).mockResolvedValue(fatura("ESTORNADA")),
      findUniqueOrThrow: vi.fn().mockResolvedValue(fatura("ESTORNADA")),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("estorno de fatura", () => {
  it("estorna pagamento preservando referência e exige revisão comercial", async () => {
    const { tx, db } = banco();

    const resultado = await new EstornarFaturaService(db as never)
      .execute("f1", "Pagamento devolvido ao assinante", auditoria, agora);

    expect(resultado).toEqual(expect.objectContaining({
      status: "ESTORNADA", estornadaEm: agora, duplicado: false, exigeRevisaoComercial: true,
      gatewayFaturaId: "rec-1",
    }));
    expect(tx.fatura.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: "PAGA" },
      data: { status: "ESTORNADA", estornadaEm: agora },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "FATURA_ESTORNADA",
      mudancas: expect.objectContaining({ motivo: "Pagamento devolvido ao assinante", referenciaPagamento: "rec-1" }),
    }) });
  });

  it("é idempotente quando já está estornada", async () => {
    const { tx, db } = banco("ESTORNADA");
    const resultado = await new EstornarFaturaService(db as never).execute("f1", "Repetição", auditoria, agora);
    expect(resultado.duplicado).toBe(true);
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it.each(["RASCUNHO", "ABERTA", "VENCIDA", "CANCELADA"])("recusa estorno de fatura %s", async (status) => {
    const { tx, db } = banco(status);
    await expect(new EstornarFaturaService(db as never).execute("f1", "Motivo válido", auditoria, agora))
      .rejects.toThrow("FATURA_NAO_ESTORNAVEL");
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it("trata estorno concorrente como repetição", async () => {
    const { tx, db } = banco();
    tx.fatura.updateMany.mockResolvedValue({ count: 0 });
    const resultado = await new EstornarFaturaService(db as never).execute("f1", "Motivo válido", auditoria, agora);
    expect(resultado.duplicado).toBe(true);
    expect(tx.auditLogPlataforma.create).not.toHaveBeenCalled();
  });
});
