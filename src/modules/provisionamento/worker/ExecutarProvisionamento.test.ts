import { describe, expect, it, vi } from "vitest";

import { ExecutarProvisionamento } from "./ExecutarProvisionamento";
import { EventoParaProcessar, InfraestruturaTenant, RepositorioProvisionamento } from "./contratos";

const evento: EventoParaProcessar = {
  id: "evento-1",
  ambienteTenantId: "ambiente-1",
  tenantKey: "tenant-1",
  chaveIdempotencia: "criar:assinante-1",
  etapaAtual: null,
};

function dependencias() {
  const repositorio: RepositorioProvisionamento = {
    obterProximoElegivel: vi.fn().mockResolvedValue(evento),
    iniciar: vi.fn().mockResolvedValue(true),
    obterInventario: vi.fn().mockResolvedValue(null),
    concluirEtapa: vi.fn(),
    concluir: vi.fn(),
    falhar: vi.fn(),
  };
  const infraestrutura: InfraestruturaTenant = {
    criarOuReconciliarProjeto: vi.fn().mockResolvedValue({
      providerProjectId: "project-1",
      providerBranchId: "branch-1",
      providerEndpointId: "endpoint-1",
      databaseName: "sysbelt",
      roleName: "runtime",
      postgresVersion: 16,
      pooledUrl: "postgresql://pooled",
      directUrl: "postgresql://direct",
    }),
    gravarOuValidarSegredo: vi.fn().mockResolvedValue({
      secretRef: "sysbelt/prod/tenants/tenant-1/database",
      chavePublicaIntegracao: "-----BEGIN PUBLIC KEY-----\npublica\n-----END PUBLIC KEY-----\n",
    }),
    aplicarMigrations: vi.fn().mockResolvedValue("20260812110000"),
    executarBootstrap: vi.fn(),
    validarSaude: vi.fn(),
  };
  return { repositorio, infraestrutura };
}

describe("worker de provisionamento", () => {
  it("executa e persiste todas as etapas na ordem", async () => {
    const { repositorio, infraestrutura } = dependencias();
    await new ExecutarProvisionamento(repositorio, infraestrutura).execute(evento);

    expect(repositorio.concluirEtapa).toHaveBeenCalledTimes(5);
    expect(repositorio.concluirEtapa).toHaveBeenNthCalledWith(
      2, "evento-1", "ambiente-1", "SEGREDO_GRAVADO", {
        secretRef: "sysbelt/prod/tenants/tenant-1/database",
        chavePublicaIntegracao: "-----BEGIN PUBLIC KEY-----\npublica\n-----END PUBLIC KEY-----\n",
      },
    );
    expect(repositorio.concluirEtapa).toHaveBeenNthCalledWith(
      5, "evento-1", "ambiente-1", "HEALTH_CHECK_VALIDADO",
    );
    expect(repositorio.concluir).toHaveBeenCalledWith("evento-1", "ambiente-1");
  });

  it("retoma após migrations sem repetir projeto, segredo ou migration", async () => {
    const { repositorio, infraestrutura } = dependencias();
    vi.mocked(repositorio.obterInventario).mockResolvedValue({
      providerProjectId: "project-1", providerBranchId: "branch-1",
      providerEndpointId: "endpoint-1", databaseName: "sysbelt",
      roleName: "runtime", postgresVersion: 16, secretRef: "secret-ref",
    });

    await new ExecutarProvisionamento(repositorio, infraestrutura).execute({
      ...evento, etapaAtual: "MIGRATIONS_APLICADAS",
    });

    expect(infraestrutura.criarOuReconciliarProjeto).not.toHaveBeenCalled();
    expect(infraestrutura.gravarOuValidarSegredo).not.toHaveBeenCalled();
    expect(infraestrutura.aplicarMigrations).not.toHaveBeenCalled();
    expect(infraestrutura.executarBootstrap).toHaveBeenCalledOnce();
    expect(infraestrutura.validarSaude).toHaveBeenCalledOnce();
  });

  it("não executa quando outro worker adquiriu o evento", async () => {
    const { repositorio, infraestrutura } = dependencias();
    vi.mocked(repositorio.iniciar).mockResolvedValue(false);

    await new ExecutarProvisionamento(repositorio, infraestrutura).execute(evento);

    expect(infraestrutura.criarOuReconciliarProjeto).not.toHaveBeenCalled();
    expect(repositorio.falhar).not.toHaveBeenCalled();
  });

  it("registra falha sanitizada e mantém o erro para retentativa", async () => {
    const { repositorio, infraestrutura } = dependencias();
    vi.mocked(infraestrutura.criarOuReconciliarProjeto).mockRejectedValue(
      new Error("Falha em postgresql://user:senha@host/db token=abc"),
    );

    await expect(new ExecutarProvisionamento(repositorio, infraestrutura).execute(evento)).rejects.toThrow();
    expect(repositorio.falhar).toHaveBeenCalledWith(
      "evento-1", "ambiente-1", "Falha em [REDACTED] [REDACTED]",
    );
  });

  it("não conclui a etapa quando o adaptador omite a chave pública", async () => {
    const { repositorio, infraestrutura } = dependencias();
    vi.mocked(infraestrutura.gravarOuValidarSegredo).mockResolvedValue({
      secretRef: "secret-ref",
      chavePublicaIntegracao: "",
    });

    await expect(new ExecutarProvisionamento(repositorio, infraestrutura).execute(evento))
      .rejects.toThrow("chave pública válidas");
    expect(repositorio.concluirEtapa).toHaveBeenCalledTimes(1);
    expect(repositorio.falhar).toHaveBeenCalledOnce();
  });
});
