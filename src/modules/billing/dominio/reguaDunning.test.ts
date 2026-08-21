import { describe, expect, it } from "vitest";
import { passosPendentes, REGUA_DUNNING_PADRAO } from "./reguaDunning";

describe("régua de dunning", () => {
  it("usa a régua comercial aprovada", () => {
    expect(REGUA_DUNNING_PADRAO.map(({ dia }) => dia)).toEqual([0, 1, 3, 7, 10]);
  });

  it("não agenda novamente passos já executados", () => {
    expect(passosPendentes(7, [0, 1, 3]).map(({ dia }) => dia)).toEqual([7]);
  });
});
