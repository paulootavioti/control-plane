export type EventoParaProcessar = {
  id: string;
  ambienteTenantId: string;
  tenantKey: string;
  chaveIdempotencia: string;
  etapaAtual: EtapaConcluida | null;
};

export type InventarioProjeto = {
  providerProjectId: string;
  providerBranchId: string;
  providerEndpointId: string;
  databaseName: string;
  roleName: string;
  postgresVersion: number;
};

export type SegredoTenantRegistrado = {
  secretRef: string;
  chavePublicaIntegracao: string;
};

export type EtapaConcluida =
  | "PROJETO_CRIADO"
  | "SEGREDO_GRAVADO"
  | "MIGRATIONS_APLICADAS"
  | "BOOTSTRAP_EXECUTADO"
  | "HEALTH_CHECK_VALIDADO";

export interface InfraestruturaTenant {
  criarOuReconciliarProjeto(evento: EventoParaProcessar): Promise<InventarioProjeto>;
  // O adaptador gera o par Ed25519 e grava a chave privada junto às URLs do
  // banco no cofre. Somente a referência e a chave pública retornam daqui.
  gravarOuValidarSegredo(
    evento: EventoParaProcessar,
    inventario: InventarioProjeto,
  ): Promise<SegredoTenantRegistrado>;
  aplicarMigrations(evento: EventoParaProcessar, secretRef: string): Promise<string>;
  executarBootstrap(evento: EventoParaProcessar, secretRef: string): Promise<void>;
  validarSaude(evento: EventoParaProcessar, secretRef: string): Promise<void>;
}

export interface RepositorioProvisionamento {
  obterProximoElegivel(): Promise<EventoParaProcessar | null>;
  iniciar(eventoId: string): Promise<boolean>;
  obterInventario(ambienteTenantId: string): Promise<(InventarioProjeto & { secretRef: string | null }) | null>;
  concluirEtapa(
    eventoId: string,
    ambienteTenantId: string,
    etapa: EtapaConcluida,
    dados?: Partial<InventarioProjeto> & Partial<SegredoTenantRegistrado> & { schemaVersaoAtual?: string },
  ): Promise<void>;
  concluir(eventoId: string, ambienteTenantId: string): Promise<void>;
  falhar(eventoId: string, ambienteTenantId: string, erroSanitizado: string): Promise<void>;
}
