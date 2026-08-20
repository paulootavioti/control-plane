CREATE TYPE "StatusLicencaUnidade" AS ENUM ('PENDENTE', 'ATIVA', 'ENCERRADA');

CREATE TABLE "LicencaUnidade" (
  "id" UUID NOT NULL,
  "assinanteId" UUID NOT NULL,
  "tenantUnidadeId" TEXT NOT NULL,
  "nomeExibicao" TEXT NOT NULL,
  "status" "StatusLicencaUnidade" NOT NULL DEFAULT 'PENDENTE',
  "inicioCobrancaEm" TIMESTAMP(3),
  "encerramentoCobrancaEm" TIMESTAMP(3),
  "ultimaSincronizacaoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LicencaUnidade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LicencaUnidade_datas_check" CHECK (
    "encerramentoCobrancaEm" IS NULL OR
    ("inicioCobrancaEm" IS NOT NULL AND "encerramentoCobrancaEm" >= "inicioCobrancaEm")
  )
);

CREATE TABLE "SnapshotContagem" (
  "id" UUID NOT NULL,
  "assinanteId" UUID NOT NULL,
  "eventoExternoId" TEXT NOT NULL,
  "versaoContrato" INTEGER NOT NULL DEFAULT 1,
  "dataCorte" TIMESTAMP(3) NOT NULL,
  "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SnapshotContagem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SnapshotContagem_versao_check" CHECK ("versaoContrato" = 1)
);

CREATE TABLE "SnapshotContagemItem" (
  "id" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "assinanteId" UUID NOT NULL,
  "licencaUnidadeId" UUID NOT NULL,
  "alunosAtivos" INTEGER NOT NULL,
  CONSTRAINT "SnapshotContagemItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SnapshotContagemItem_alunos_check" CHECK ("alunosAtivos" >= 0)
);

CREATE UNIQUE INDEX "LicencaUnidade_assinanteId_tenantUnidadeId_key" ON "LicencaUnidade"("assinanteId", "tenantUnidadeId");
CREATE UNIQUE INDEX "LicencaUnidade_id_assinanteId_key" ON "LicencaUnidade"("id", "assinanteId");
CREATE INDEX "LicencaUnidade_assinanteId_status_idx" ON "LicencaUnidade"("assinanteId", "status");
CREATE UNIQUE INDEX "SnapshotContagem_assinanteId_eventoExternoId_key" ON "SnapshotContagem"("assinanteId", "eventoExternoId");
CREATE UNIQUE INDEX "SnapshotContagem_id_assinanteId_key" ON "SnapshotContagem"("id", "assinanteId");
CREATE INDEX "SnapshotContagem_assinanteId_dataCorte_idx" ON "SnapshotContagem"("assinanteId", "dataCorte");
CREATE UNIQUE INDEX "SnapshotContagemItem_snapshotId_licencaUnidadeId_key" ON "SnapshotContagemItem"("snapshotId", "licencaUnidadeId");
CREATE INDEX "SnapshotContagemItem_licencaUnidadeId_idx" ON "SnapshotContagemItem"("licencaUnidadeId");

ALTER TABLE "LicencaUnidade" ADD CONSTRAINT "LicencaUnidade_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SnapshotContagem" ADD CONSTRAINT "SnapshotContagem_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SnapshotContagemItem" ADD CONSTRAINT "SnapshotContagemItem_snapshotId_assinanteId_fkey" FOREIGN KEY ("snapshotId", "assinanteId") REFERENCES "SnapshotContagem"("id", "assinanteId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SnapshotContagemItem" ADD CONSTRAINT "SnapshotContagemItem_licencaUnidadeId_assinanteId_fkey" FOREIGN KEY ("licencaUnidadeId", "assinanteId") REFERENCES "LicencaUnidade"("id", "assinanteId") ON DELETE RESTRICT ON UPDATE CASCADE;
