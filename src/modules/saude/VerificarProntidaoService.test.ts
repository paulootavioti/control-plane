import { describe, expect, it, vi } from "vitest";
import { VerificarProntidaoService } from "./VerificarProntidaoService";

describe("prontidão da aplicação", () => {
  it("fica pronta quando o banco responde", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ ok: 1 }]);
    await expect(new VerificarProntidaoService({ $queryRaw: queryRaw }).execute()).resolves.toBe(true);
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("fica indisponível sem propagar detalhes do banco", async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error("postgresql://usuario:senha@host/base"));
    await expect(new VerificarProntidaoService({ $queryRaw: queryRaw }).execute()).resolves.toBe(false);
  });
});
