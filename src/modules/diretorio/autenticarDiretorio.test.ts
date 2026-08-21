import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { autenticarDiretorio } from "./autenticarDiretorio";

function executar(headers: Record<string, string>, params: Record<string, string> = { produto: "psyche" }) {
  const request = { params, header: (nome: string) => headers[nome.toLowerCase()] } as Request;
  const status = vi.fn();
  const json = vi.fn();
  const setHeader = vi.fn();
  const response = { status: status.mockReturnValue({ json }), setHeader } as unknown as Response;
  const next = vi.fn() as NextFunction;
  autenticarDiretorio(request, response, next);
  return { status, next, setHeader };
}

describe("autenticarDiretorio", () => {
  afterEach(() => {
    delete process.env.CONTROL_PLANE_PRODUCT_CREDENTIALS;
    delete process.env.CONTROL_PLANE_DIRECTORY_LEGACY_ENABLED;
    delete process.env.CONTROL_PLANE_DIRECTORY_SECRET;
  });

  it("isola a credencial versionada por produto", () => {
    process.env.CONTROL_PLANE_PRODUCT_CREDENTIALS = JSON.stringify({
      psyche: { v2: "p".repeat(32) }, sysbelt: { v2: "s".repeat(32) },
    });
    expect(executar({ authorization: `Bearer ${"p".repeat(32)}`, "x-control-plane-credential-version": "v2" }).next)
      .toHaveBeenCalledOnce();
    expect(executar({ authorization: `Bearer ${"s".repeat(32)}`, "x-control-plane-credential-version": "v2" }).status)
      .toHaveBeenCalledWith(401);
  });

  it("aceita o segredo legado apenas para SysBelt com flag explícita", () => {
    process.env.CONTROL_PLANE_DIRECTORY_LEGACY_ENABLED = "true";
    process.env.CONTROL_PLANE_DIRECTORY_SECRET = "l".repeat(32);
    const resultado = executar({ "x-sysbelt-directory-secret": "l".repeat(32) }, {});
    expect(resultado.next).toHaveBeenCalledOnce();
    expect(resultado.setHeader).toHaveBeenCalledWith("deprecation", "true");
  });
});
