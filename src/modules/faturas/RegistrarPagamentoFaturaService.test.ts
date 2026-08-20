import { describe, expect, it, vi } from "vitest";

import { RegistrarPagamentoFaturaService } from "./RegistrarPagamentoFaturaService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };
const agora = new Date("2026-08-13T02:00:00.000Z");

function fatura(status = "ABERTA", referencia: string | null = null) {
  return {
    id: "f1", assinanteId: "a1", assinaturaId: "ass1", competencia: "2026-08",
    status, totalCentavos: 35000, moeda: "BRL",
    gateway: referencia ? "MANUAL" : null, gatewayFaturaId: referencia,
    pagaEm: status === "PAGA" ? agora : null,
  };
}

function banco(status = "ABERTA", referencia: string | null = null) {
  const tx = {
    fatura: {
      findUnique: vi.fn().mockResolvedValueOnce(fatura(status, referencia)).mockResolvedValue(fatura("PAGA", "rec-1")),
      findUniqueOrThrow: vi.fn().mockResolvedValue(fatura("PAGA", "rec-1")),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    assinatura: {
      findUnique: vi.fn().mockResolvedValue({ id: "ass1", status: "ATIVA", encerradaEm: null }),
      update: vi.fn(),
    },
    ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ id: "amb1", status: "ATIVO" }) },
    auditLogPlataforma: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (operacao) => operacao(tx)) } };
}

describe("registro de pagamento da fatura", () => {
  it.each(["ABERTA", "VENCIDA"])("baixa fatura %s e audita", async (status) => {
    const { tx, db } = banco(status);

    const resultado = await new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-1", auditoria, agora);

    expect(resultado).toEqual(expect.objectContaining({
      status: "PAGA", duplicado: false, regularizouAssinatura: false,
      exigeEnvioConcessao: false,
    }));
    expect(tx.fatura.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: { in: ["ABERTA", "VENCIDA"] } },
      data: { status: "PAGA", pagaEm: agora, gateway: "MANUAL", gatewayFaturaId: "rec-1" },
    });
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "FATURA_PAGA",
      mudancas: expect.objectContaining({ statusAnterior: status, referenciaPagamento: "rec-1" }),
    }) });
  });

  it("regulariza assinatura inadimplente quando não resta cobrança vencida", async () => {
    const { tx, db } = banco("VENCIDA");
    tx.assinatura.findUnique.mockResolvedValue({ id: "ass1", status: "INADIMPLENTE", encerradaEm: null });
    tx.fatura.count.mockResolvedValue(0);

    const resultado = await new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-1", auditoria, agora);

    expect(tx.assinatura.update).toHaveBeenCalledWith({ where: { id: "ass1" }, data: { status: "ATIVA" } });
    expect(resultado).toEqual(expect.objectContaining({
      regularizouAssinatura: true, ambienteId: "amb1", exigeEnvioConcessao: true,
    }));
    expect(tx.auditLogPlataforma.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "ASSINATURA_REGULARIZADA_POR_PAGAMENTO",
      alvoId: "ass1",
    }) });
  });

  it("mantém inadimplência quando existe outra cobrança vencida", async () => {
    const { tx, db } = banco("VENCIDA");
    tx.assinatura.findUnique.mockResolvedValue({ id: "ass1", status: "INADIMPLENTE", encerradaEm: null });
    tx.fatura.count.mockResolvedValue(1);

    const resultado = await new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-1", auditoria, agora);

    expect(tx.assinatura.update).not.toHaveBeenCalled();
    expect(resultado.regularizouAssinatura).toBe(false);
  });

  it("não reativa automaticamente quando o ambiente está suspenso", async () => {
    const { tx, db } = banco("VENCIDA");
    tx.assinatura.findUnique.mockResolvedValue({ id: "ass1", status: "INADIMPLENTE", encerradaEm: null });
    tx.fatura.count.mockResolvedValue(0);
    tx.ambienteTenant.findUnique.mockResolvedValue({ id: "amb1", status: "SUSPENSO" });

    const resultado = await new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-1", auditoria, agora);

    expect(tx.assinatura.update).not.toHaveBeenCalled();
    expect(resultado).toEqual(expect.objectContaining({
      regularizouAssinatura: false, ambienteId: null, exigeEnvioConcessao: false,
    }));
  });

  it("é idempotente para a mesma confirmação", async () => {
    const { tx, db } = banco("PAGA", "rec-1");

    const resultado = await new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-1", auditoria, agora);

    expect(resultado.duplicado).toBe(true);
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it("recusa nova referência para fatura já paga", async () => {
    const { tx, db } = banco("PAGA", "rec-antiga");

    await expect(new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-nova", auditoria, agora)).rejects.toThrow("FATURA_JA_PAGA");
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });

  it.each(["RASCUNHO", "CANCELADA", "ESTORNADA"])("recusa pagamento de fatura %s", async (status) => {
    const { tx, db } = banco(status);

    await expect(new RegistrarPagamentoFaturaService(db as never)
      .execute("f1", "MANUAL", "rec-1", auditoria, agora)).rejects.toThrow("FATURA_NAO_PAGAVEL");
    expect(tx.fatura.updateMany).not.toHaveBeenCalled();
  });
});
