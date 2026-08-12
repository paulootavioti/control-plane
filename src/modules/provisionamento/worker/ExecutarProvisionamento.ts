import { sanitizarErroProvisionamento } from "../regrasProvisionamento";
import {
  EtapaConcluida,
  EventoParaProcessar,
  InfraestruturaTenant,
  InventarioProjeto,
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
      await this.repositorio.iniciar(evento.id);
      let existente = await this.repositorio.obterInventario(evento.ambienteTenantId);
      let inventario: InventarioProjeto;

      if (precisaExecutar(etapaAtual, "PROJETO_CRIADO")) {
        inventario = await this.infraestrutura.criarOuReconciliarProjeto(evento);
        await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "PROJETO_CRIADO", inventario);
        etapaAtual = "PROJETO_CRIADO";
      } else {
        if (!existente) throw new Error("Inventário do projeto não encontrado para retomada.");
        inventario = existente;
      }

      existente = existente ?? { ...inventario, secretRef: null };
      let secretRef = existente.secretRef;
      if (precisaExecutar(etapaAtual, "SEGREDO_GRAVADO")) {
        secretRef = await this.infraestrutura.gravarOuValidarSegredo(evento, inventario);
        await this.repositorio.concluirEtapa(evento.id, evento.ambienteTenantId, "SEGREDO_GRAVADO", { secretRef });
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
      );
      throw erro;
    }
  }
}
