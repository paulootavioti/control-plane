import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ConfigurarChaveSnapshotService } from "./ConfigurarChaveSnapshotService";

const auditoria = { operadorId: "op1", origem: "OPERADOR" as const, ip: null, userAgent: null };

describe("configuração da chave de snapshots", () => {
  it("valida Ed25519, persiste a pública e audita sem expor a chave", async () => {
    const publica = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const tx = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ id: "amb1", provider: "COMPARTILHADO" }), update: vi.fn() }, auditLogPlataforma: { create: vi.fn() } };
    const db = { $transaction: vi.fn(async (fn) => fn(tx)) };
    const resultado = await new ConfigurarChaveSnapshotService(db as never).execute("a1", publica, auditoria);
    expect(tx.ambienteTenant.update).toHaveBeenCalledWith({ where: { id: "amb1" }, data: { chavePublicaIntegracao: publica } });
    expect(tx.auditLogPlataforma.create.mock.calls[0][0].data.mudancas).toEqual({ algoritmo: "Ed25519" });
    expect(resultado).toEqual({ ambienteId: "amb1", chavePublicaConfigurada: true, algoritmo: "Ed25519" });
  });

  it("recusa chave que não seja Ed25519", async () => {
    const db = { $transaction: vi.fn() };
    await expect(new ConfigurarChaveSnapshotService(db as never).execute("a1", "invalida", auditoria))
      .rejects.toThrow("CHAVE_PUBLICA_INVALIDA");
  });
});
