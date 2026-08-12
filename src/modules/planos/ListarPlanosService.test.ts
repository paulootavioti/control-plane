import { describe, expect, it, vi } from "vitest";

import { ListarPlanosService } from "./ListarPlanosService";

describe("catálogo de planos", () => {
  const agora = new Date("2026-08-12T12:00:00.000Z");

  it("por padrão consulta apenas planos ativos e versões vigentes", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await new ListarPlanosService({ plano: { findMany } } as never).execute(false, agora);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ativo: true },
      select: expect.objectContaining({
        versoes: expect.objectContaining({
          where: {
            vigenteDesde: { lte: agora },
            OR: [{ vigenteAte: null }, { vigenteAte: { gt: agora } }],
          },
        }),
      }),
    }));
  });

  it("histórico remove filtros sem alterar versões", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "p1", versoes: [{ versao: 2 }, { versao: 1 }] }]);
    const resultado = await new ListarPlanosService({ plano: { findMany } } as never).execute(true, agora);

    const consulta = findMany.mock.calls[0][0];
    expect(consulta.where).toBeUndefined();
    expect(consulta.select.versoes.where).toBeUndefined();
    expect(resultado[0].versoes).toEqual([{ versao: 2 }, { versao: 1 }]);
  });
});
