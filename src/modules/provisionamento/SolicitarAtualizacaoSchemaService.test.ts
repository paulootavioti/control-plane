import { describe, expect, it, vi } from "vitest";
import { SolicitarAtualizacaoSchemaService } from "./SolicitarAtualizacaoSchemaService";
it("solicita migration idempotente e auditada", async () => {
  const tx = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ id:"a", assinanteId:"s", status:"ATIVO", schemaVersaoAtual:"1", schemaVersaoDesejada:"1" }), update: vi.fn() }, eventoProvisionamento: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id:"e" }) }, auditLogPlataforma: { create: vi.fn() } };
  const db = { $transaction: (fn: any) => fn(tx) };
  await expect(new SolicitarAtualizacaoSchemaService(db as never).execute("a","2",{ operadorId:"o",origem:"OPERADOR",ip:null,userAgent:null })).resolves.toMatchObject({ eventoId:"e", duplicado:false });
  expect(tx.eventoProvisionamento.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo:"APLICAR_MIGRATIONS", chaveIdempotencia:"migrations:a:2" }) }));
});
