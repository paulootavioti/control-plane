import { sanitizarErroProvisionamento } from "../regrasProvisionamento";
import {
  EtapaConcluida,
  EventoParaProcessar,
  InfraestruturaTenant,
  InventarioProjeto,
  ProjetoProvisionado,
  RepositorioProvisionamento,
} from "./contratos";

const ORDEM: EtapaConcluida[] = [
  "PROJETO_CRIADO",
  "SEGREDO_GRAVADO",
  "MIGRATIONS_APLICADAS",
  "BOOTSTRAP_EXECUTADO",
  "HEALTH_CHECK_VALIDADO",
];

function precisaExecutar(atual: EtapaConcluida | null, etapa: EtapaConcluida): boolean {
  return atual === null || ORDEM.indexOf(atual) < ORDEM.indexOf(etapa);
}

export class ExecutarProvisionamento {
  constructor(
    private readonly repositorio: RepositorioProvisionamento,
    private readonly infraestrutura: InfraestruturaTenant,
  ) {}

  async execute(evento: EventoParaProcessar): Promise<void> {
    let etapaAtual = evento.etapaAtual;

    try {
      const adquirido = await this.repositorio.iniciar(evento.id);
      if (!adquirido) return;
      if (evento.tipo !== "CRIAR_AMBIENTE") {
        const inventarioOperacional = await this.repositorio.obterInventario(evento.ambienteTenantId);
        if (!inventarioOperacional?.secretRef) throw new Error("Operação requer segredo do ambiente provisionado.");
        if (evento.tipo === "APLICAR_MIGRATIONS") {
          const schemaVersaoAtual = await this.infraestrutura.aplicarMigrations(evento, inventarioOperacional.secretRef);
          await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "MIGRATIONS_APLICADAS", { schemaVersaoAtual });
        } else if (evento.tipo === "ROTACIONAR_CREDENCIAL") {
          await this.infraestrutura.rotacionarCredencial(evento, inventarioOperacional.secretRef);
        } else if (evento.tipo === "SUSPENDER") {
          await this.infraestrutura.suspender(evento, inventarioOperacional.secretRef);
        } else {
          await this.infraestrutura.reativar(evento, inventarioOperacional.secretRef);
        }
        await this.repositorio.concluir(evento.id, evento.ambienteTenantId, evento.tipo === "SUSPENDER" ? "SUSPENSO" : "ATIVO");
        return;
      }
      let existente = await this.repositorio.obterInventario(evento.ambienteTenantId);
      let inventario: ProjetoProvisionado;

      if (precisaExecutar(etapaAtual, "PROJETO_CRIADO")) {
        inventario = await this.infraestrutura.criarOuReconciliarProjeto(evento);
        await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "PROJETO_CRIADO", inventario);
        etapaAtual = "PROJETO_CRIADO";
      } else {
        if (!existente) throw new Error("Inventário do projeto não encontrado para retomada.");
        if (!existente.secretRef) {
          throw new Error("Retomada requer credenciais transitórias no cofre antes de concluir a etapa do projeto.");
        }
        inventario = { ...existente, pooledUrl: "", directUrl: "" };
      }

      existente = existente ?? { ...inventario, secretRef: null };
      let secretRef = existente.secretRef;
      if (precisaExecutar(etapaAtual, "SEGREDO_GRAVADO")) {
        const segredo = await this.infraestrutura.gravarOuValidarSegredo(evento, inventario);
        if (
          !segredo.secretRef ||
          !segredo.chavePublicaIntegracao.includes("-----BEGIN PUBLIC KEY-----") ||
          segredo.chavePublicaIntegracao.includes("PRIVATE KEY")
        ) {
          throw new Error("Adaptador não registrou referência e chave pública válidas.");
        }
        secretRef = segredo.secretRef;
        await this.repositorio.concluirEtapa(
          evento.id,
          evento.ambienteTenantId,
          "SEGREDO_GRAVADO",
          segredo,
        );
        etapaAtual = "SEGREDO_GRAVADO";
      }
      if (!secretRef) throw new Error("Referência do segredo não encontrada para retomada.");

      if (precisaExecutar(etapaAtual, "MIGRATIONS_APLICADAS")) {
        const schemaVersaoAtual = await this.infraestrutura.aplicarMigrations(evento, secretRef);
        await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "MIGRATIONS_APLICADAS", { schemaVersaoAtual });
        etapaAtual = "MIGRATIONS_APLICADAS";
      }

      if (precisaExecutar(etapaAtual, "BOOTSTRAP_EXECUTADO")) {
        await this.infraestrutura.executarBootstrap(evento, secretRef);
        await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "BOOTSTRAP_EXECUTADO");
        etapaAtual = "BOOTSTRAP_EXECUTADO";
      }

      if (precisaExecutar(etapaAtual, "HEALTH_CHECK_VALIDADO")) {
        await this.infraestrutura.validarSaude(evento, secretRef);
        await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "HEALTH_CHECK_VALIDADO");
      }

      await this.repositorio.concluir(evento.id, evento.ambienteTenantId);
    } catch (erro) {
      await this.repositorio.falhar(
        evento.id,
        evento.ambienteTenantId,
        sanitizarErroProvisionamento(erro),
        evento.tipo,
      );
      throw erro;
    }
  }
}
