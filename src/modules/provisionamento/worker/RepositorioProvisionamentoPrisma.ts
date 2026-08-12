import { Prisma, PrismaClient, StatusAmbienteTenant } from "@prisma/client";

import {
  EtapaConcluida,
  EventoParaProcessar,
  InventarioProjeto,
  RepositorioProvisionamento,
} from "./contratos";

const statusPorEtapa: Record<EtapaConcluida, StatusAmbienteTenant> = {
  PROJETO_CRIADO: "GRAVANDO_SEGREDO",
  SEGREDO_GRAVADO: "APLICANDO_MIGRATIONS",
  MIGRATIONS_APLICADAS: "EXECUTANDO_BOOTSTRAP",
  BOOTSTRAP_EXECUTADO: "VALIDANDO",
  HEALTH_CHECK_VALIDADO: "VALIDANDO",
};

export class RepositorioProvisionamentoPrisma implements RepositorioProvisionamento {
  constructor(private readonly db: PrismaClient) {}

  async obterProximoElegivel(): Promise<EventoParaProcessar | null> {
    const evento = await this.db.eventoProvisionamento.findFirst({
      where: {
        tentativas: { lt: 5 },
        OR: [
          { status: "PENDENTE" },
          { status: "FALHOU", proximaTentativaEm: { lte: new Date() } },
        ],
      },
      include: { ambiente: { select: { tenantKey: true } } },
      orderBy: [{ proximaTentativaEm: "asc" }, { criadoEm: "asc" }],
    });

    if (!evento) return null;
    return {
      id: evento.id,
      ambienteTenantId: evento.ambienteTenantId,
      tenantKey: evento.ambiente.tenantKey,
      chaveIdempotencia: evento.chaveIdempotencia,
      etapaAtual: evento.etapaAtual as EtapaConcluida | null,
    };
  }

  async iniciar(eventoId: string): Promise<boolean> {
    const agora = new Date();
    const resultado = await this.db.eventoProvisionamento.updateMany({
      where: {
        id: eventoId,
        tentativas: { lt: 5 },
        OR: [
          { status: "PENDENTE" },
          { status: "FALHOU", proximaTentativaEm: { lte: agora } },
        ],
      },
      data: {
        status: "EXECUTANDO",
        iniciadoEm: agora,
        concluidoEm: null,
        erroSanitizado: null,
        proximaTentativaEm: null,
        tentativas: { increment: 1 },
      },
    });
    return resultado.count === 1;
  }

  async obterInventario(ambienteTenantId: string) {
    return this.db.ambienteTenant.findUnique({
      where: { id: ambienteTenantId },
      select: {
        providerProjectId: true, providerBranchId: true, providerEndpointId: true,
        databaseName: true, roleName: true, postgresVersion: true, secretRef: true,
      },
    }) as Promise<(InventarioProjeto & { secretRef: string | null }) | null>;
  }

  async concluirEtapa(
    eventoId: string,
    ambienteTenantId: string,
    etapa: EtapaConcluida,
    dados: Partial<InventarioProjeto> & { secretRef?: string; schemaVersaoAtual?: string } = {},
  ): Promise<void> {
    const ambienteData: Prisma.AmbienteTenantUpdateInput = {
      status: statusPorEtapa[etapa],
      ...(dados.providerProjectId && { providerProjectId: dados.providerProjectId }),
      ...(dados.providerBranchId && { providerBranchId: dados.providerBranchId }),
      ...(dados.providerEndpointId && { providerEndpointId: dados.providerEndpointId }),
      ...(dados.databaseName && { databaseName: dados.databaseName }),
      ...(dados.roleName && { roleName: dados.roleName }),
      ...(dados.postgresVersion && { postgresVersion: dados.postgresVersion }),
      ...(dados.secretRef && { secretRef: dados.secretRef, credentialVersion: 1 }),
      ...(dados.schemaVersaoAtual && { schemaVersaoAtual: dados.schemaVersaoAtual, ultimaMigrationEm: new Date() }),
      ...(etapa === "HEALTH_CHECK_VALIDADO" && { ultimoHealthCheckEm: new Date() }),
    };

    await this.db.$transaction([
      this.db.ambienteTenant.update({ where: { id: ambienteTenantId }, data: ambienteData }),
      this.db.eventoProvisionamento.update({ where: { id: eventoId }, data: { etapaAtual: etapa } }),
    ]);
  }

  async concluir(eventoId: string, ambienteTenantId: string): Promise<void> {
    await this.db.$transaction([
      this.db.ambienteTenant.update({ where: { id: ambienteTenantId }, data: { status: "ATIVO" } }),
      this.db.eventoProvisionamento.update({
        where: { id: eventoId }, data: { status: "CONCLUIDO", concluidoEm: new Date() },
      }),
    ]);
  }

  async falhar(eventoId: string, ambienteTenantId: string, erroSanitizado: string): Promise<void> {
    const evento = await this.db.eventoProvisionamento.findUniqueOrThrow({
      where: { id: eventoId }, select: { tentativas: true },
    });
    const minutos = Math.min(2 ** Math.max(evento.tentativas - 1, 0), 30);
    const proximaTentativaEm = evento.tentativas < 5
      ? new Date(Date.now() + minutos * 60_000)
      : null;

    await this.db.$transaction([
      this.db.ambienteTenant.update({ where: { id: ambienteTenantId }, data: { status: "FALHOU" } }),
      this.db.eventoProvisionamento.update({
        where: { id: eventoId },
        data: { status: "FALHOU", erroSanitizado, proximaTentativaEm },
      }),
    ]);
  }
}
