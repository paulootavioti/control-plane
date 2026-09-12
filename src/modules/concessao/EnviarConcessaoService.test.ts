import { afterEach, describe, expect, it, vi } from "vitest";

import { EnviarConcessaoService } from "./EnviarConcessaoService";

const concessao = {
  versao: 1 as const,
  tenantKey: "6af23aa7-bd57-4428-aeae-3a237025bb68",
  revisao: 7,
  statusAcesso: "ATIVO" as const,
  recursos: [] as never[],
  emitidaEm: "2026-08-12T12:00:00.000Z",
  expiraEm: "2026-08-13T12:00:00.000Z",
  assinatura: "assinatura",
};

afterEach(() => {
  delete process.env.TENANT_APP_BASE_DOMAIN;
  delete process.env.TENANT_PRODUCT_HOST_MAP;
});

describe("entrega de concessão", () => {
  it("recusa ambiente pendente antes de gerar ou enviar a concessão", async () => {
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "PENDENTE", assinante: { slug: "academia-centro", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn();
    const gerador = { execute: vi.fn() };
    await expect(new EnviarConcessaoService(db as never, requisicao, gerador).execute("ambiente-1"))
      .rejects.toThrow("AMBIENTE_NAO_ELEGIVEL");
    expect(gerador.execute).not.toHaveBeenCalled();
    expect(requisicao).not.toHaveBeenCalled();
  });

  it("envia ao hostname derivado do slug e confirma a revisão persistida", async () => {
    process.env.TENANT_APP_BASE_DOMAIN = "app.sysbelt.com.br";
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "ATIVO", assinante: { slug: "academia-centro", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revisao: 7, duplicada: false }), {
      status: 201, headers: { "content-type": "application/json" },
    }));
    const gerador = { execute: vi.fn().mockResolvedValue(concessao) };

    const resultado = await new EnviarConcessaoService(db as never, requisicao, gerador).execute("ambiente-1");

    expect(requisicao).toHaveBeenCalledWith(
      "https://academia-centro.app.sysbelt.com.br/api/integracao/control-plane/v1/concessao",
      expect.objectContaining({ method: "POST", body: JSON.stringify(concessao) }),
    );
    expect(resultado).toEqual({
      revisao: 7, duplicada: false,
      expiraEm: concessao.expiraEm,
      destino: "https://academia-centro.app.sysbelt.com.br/api/integracao/control-plane/v1/concessao",
    });
  });

  it("envia concessão de bloqueio para ambiente suspenso", async () => {
    process.env.TENANT_APP_BASE_DOMAIN = "app.sysbelt.com.br";
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "SUSPENSO", assinante: { slug: "academia", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revisao: 7, duplicada: false }), { status: 201 }));
    const gerador = { execute: vi.fn().mockResolvedValue({ ...concessao, statusAcesso: "SUSPENSO" }) };
    await expect(new EnviarConcessaoService(db as never, requisicao, gerador).execute("ambiente-1"))
      .resolves.toMatchObject({ revisao: 7 });
  });

  it("envia ao host gratuito explicitamente mapeado", async () => {
    process.env.TENANT_PRODUCT_HOST_MAP = JSON.stringify({ "sysbelt:academia-centro": "https://sysbeltfp.netlify.app" });
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "ATIVO", assinante: { slug: "academia-centro", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revisao: 7, duplicada: false }), { status: 201 }));
    const gerador = { execute: vi.fn().mockResolvedValue(concessao) };
    await new EnviarConcessaoService(db as never, requisicao, gerador).execute("ambiente-1");
    expect(requisicao).toHaveBeenCalledWith(
      "https://sysbeltfp.netlify.app/api/integracao/control-plane/v1/concessao",
      expect.any(Object),
    );
  });

  it("não emite quando o slug poderia alterar o destino", async () => {
    process.env.TENANT_APP_BASE_DOMAIN = "app.sysbelt.com.br";
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "ATIVO", assinante: { slug: "x.example.com", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn();
    const gerador = { execute: vi.fn() };
    await expect(new EnviarConcessaoService(db as never, requisicao, gerador).execute("a1"))
      .rejects.toThrow("SLUG_ASSINANTE_INVALIDO");
    expect(gerador.execute).not.toHaveBeenCalled();
    expect(requisicao).not.toHaveBeenCalled();
  });

  it("marca falha de rede como entrega incerta", async () => {
    process.env.TENANT_APP_BASE_DOMAIN = "app.sysbelt.com.br";
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "ATIVO", assinante: { slug: "academia", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn().mockRejectedValue(new Error("timeout"));
    const gerador = { execute: vi.fn().mockResolvedValue(concessao) };
    await expect(new EnviarConcessaoService(db as never, requisicao, gerador).execute("a1"))
      .rejects.toThrow("ENTREGA_CONCESSAO_INCERTA");
  });

  it("não confirma a entrega quando a resposta não comprova a revisão", async () => {
    process.env.TENANT_APP_BASE_DOMAIN = "app.sysbelt.com.br";
    const db = { ambienteTenant: { findUnique: vi.fn().mockResolvedValue({ status: "ATIVO", assinante: { slug: "academia", produtoCodigo: "sysbelt" } }) } };
    const requisicao = vi.fn().mockResolvedValue(new Response("resposta-invalida", { status: 200 }));
    const gerador = { execute: vi.fn().mockResolvedValue(concessao) };
    await expect(new EnviarConcessaoService(db as never, requisicao, gerador).execute("a1"))
      .rejects.toThrow("RESPOSTA_TENANT_INVALIDA");
  });
});
