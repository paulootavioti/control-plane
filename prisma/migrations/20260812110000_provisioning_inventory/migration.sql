CREATE TYPE "StatusAmbienteTenant" AS ENUM ('PENDENTE', 'CRIANDO_PROJETO', 'GRAVANDO_SEGREDO', 'APLICANDO_MIGRATIONS', 'EXECUTANDO_BOOTSTRAP', 'VALIDANDO', 'ATIVO', 'FALHOU', 'SUSPENSO', 'DESATIVADO');
CREATE TYPE "TipoEventoProvisionamento" AS ENUM ('CRIAR_AMBIENTE', 'APLICAR_MIGRATIONS', 'ROTACIONAR_CREDENCIAL', 'SUSPENDER', 'REATIVAR');
CREATE TYPE "StatusEventoProvisionamento" AS ENUM ('PENDENTE', 'EXECUTANDO', 'CONCLUIDO', 'FALHOU');

CREATE TABLE "AmbienteTenant" (
  "id" UUID NOT NULL,
  "assinanteId" UUID NOT NULL,
  "tenantKey" UUID NOT NULL,
  "status" "StatusAmbienteTenant" NOT NULL DEFAULT 'PENDENTE',
  "provider" TEXT NOT NULL DEFAULT 'NEON',
  "regiao" TEXT NOT NULL,
  "providerProjectId" TEXT,
  "providerBranchId" TEXT,
  "providerEndpointId" TEXT,
  "databaseName" TEXT,
  "roleName" TEXT,
  "postgresVersion" INTEGER,
  "secretRef" TEXT,
  "credentialVersion" INTEGER,
  "schemaVersaoAtual" TEXT,
  "schemaVersaoDesejada" TEXT NOT NULL,
  "ultimaMigrationEm" TIMESTAMP(3),
  "ultimoHealthCheckEm" TIMESTAMP(3),
  "ultimoBackupVerificadoEm" TIMESTAMP(3),
  "ultimaRotacaoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AmbienteTenant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AmbienteTenant_versoes_check" CHECK ("postgresVersion" IS NULL OR "postgresVersion" >= 16),
  CONSTRAINT "AmbienteTenant_credencial_check" CHECK ("credentialVersion" IS NULL OR "credentialVersion" > 0),
  CONSTRAINT "AmbienteTenant_secret_ref_check" CHECK ("secretRef" IS NULL OR ("secretRef" NOT ILIKE '%postgresql://%' AND "secretRef" NOT ILIKE '%password=%'))
);

CREATE TABLE "EventoProvisionamento" (
  "id" UUID NOT NULL,
  "ambienteTenantId" UUID NOT NULL,
  "tipo" "TipoEventoProvisionamento" NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "status" "StatusEventoProvisionamento" NOT NULL DEFAULT 'PENDENTE',
  "etapaAtual" TEXT,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "erroSanitizado" TEXT,
  "iniciadoEm" TIMESTAMP(3),
  "concluidoEm" TIMESTAMP(3),
  "proximaTentativaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoProvisionamento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventoProvisionamento_tentativas_check" CHECK ("tentativas" >= 0),
  CONSTRAINT "EventoProvisionamento_erro_check" CHECK ("erroSanitizado" IS NULL OR ("erroSanitizado" NOT ILIKE '%postgresql://%' AND "erroSanitizado" NOT ILIKE '%password=%'))
);

CREATE UNIQUE INDEX "AmbienteTenant_assinanteId_key" ON "AmbienteTenant"("assinanteId");
CREATE UNIQUE INDEX "AmbienteTenant_tenantKey_key" ON "AmbienteTenant"("tenantKey");
CREATE UNIQUE INDEX "AmbienteTenant_providerProjectId_key" ON "AmbienteTenant"("providerProjectId");
CREATE INDEX "AmbienteTenant_status_idx" ON "AmbienteTenant"("status");
CREATE INDEX "AmbienteTenant_schemaVersaoAtual_schemaVersaoDesejada_idx" ON "AmbienteTenant"("schemaVersaoAtual", "schemaVersaoDesejada");
CREATE UNIQUE INDEX "EventoProvisionamento_chaveIdempotencia_key" ON "EventoProvisionamento"("chaveIdempotencia");
CREATE INDEX "EventoProvisionamento_status_proximaTentativaEm_idx" ON "EventoProvisionamento"("status", "proximaTentativaEm");
CREATE INDEX "EventoProvisionamento_ambienteTenantId_criadoEm_idx" ON "EventoProvisionamento"("ambienteTenantId", "criadoEm");

ALTER TABLE "AmbienteTenant" ADD CONSTRAINT "AmbienteTenant_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoProvisionamento" ADD CONSTRAINT "EventoProvisionamento_ambienteTenantId_fkey" FOREIGN KEY ("ambienteTenantId") REFERENCES "AmbienteTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
