import { describe, expect, it, vi } from "vitest";
import { ReceberSnapshotContagem } from "./ReceberSnapshotContagem";

const payload = {
  versao: 1 as const,
  eventoId: "94cb61d1-b5e9-5ce9-9016-d23811fa42b6",
  tenantKey: "64d729dc-8cbc-4fbf-9259-f28809faf55d",
  dataCorte: "2026-09-13T22:10:00.000Z",
  unidades: [{ unidadeId: "1", nomeExibicao: "Centro", status: "ATIVA" as const, alunosAtivos: 12 }],
};

describe("recebimento do snapshot agregado", () => {
  it("cria o snapshot e depois os itens por escalares na mesma transação", async () => {
    const tx = {
      licencaUnidade: { upsert: vi.fn().mockResolvedValue({ id: "lic1", tenantUnidadeId: "1" }) },
      snapshotContagem: { create: vi.fn().mockResolvedValue({ id: "snap1" }) },
      snapshotContagemItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const db = {
      snapshotContagem: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (operacao) => operacao(tx)),
    };
    await expect(new ReceberSnapshotContagem(db as never).execute("assinante1", payload))
      .resolves.toEqual({ id: "snap1", duplicado: false });
    expect(tx.snapshotContagem.create.mock.calls[0][0].data).not.toHaveProperty("itens");
    expect(tx.snapshotContagemItem.createMany).toHaveBeenCalledWith({ data: [{
      snapshotId: "snap1", assinanteId: "assinante1", licencaUnidadeId: "lic1", alunosAtivos: 12,
    }] });
  });
});
