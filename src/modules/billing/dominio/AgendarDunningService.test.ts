import { describe, expect, it, vi } from "vitest";
import { AgendarDunningService } from "./AgendarDunningService";

describe("AgendarDunningService", () => {
  it("agenda D0, D1, D3, D7 e D10 de forma idempotente", async () => {
    const tx = { assinatura: { update: vi.fn() }, tentativaDunning: { upsert: vi.fn() } };
    const db = { $transaction: (fn: (cliente: typeof tx) => unknown) => fn(tx) };
    const falha = new Date("2026-09-01T12:00:00.000Z");
    await new AgendarDunningService(db as never).execute("ass-1", falha);
    expect(tx.tentativaDunning.upsert).toHaveBeenCalledTimes(5);
    expect(tx.tentativaDunning.upsert.mock.calls.map(([arg]) => arg.create.diaRegua)).toEqual([0, 1, 3, 7, 10]);
    expect(tx.tentativaDunning.upsert.mock.calls[4][0].create.agendadaPara)
      .toEqual(new Date("2026-09-11T12:00:00.000Z"));
  });
});
