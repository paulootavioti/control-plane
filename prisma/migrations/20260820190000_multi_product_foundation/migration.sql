CREATE TYPE "PoliticaAcessoInadimplencia" AS ENUM (
  'SUSPENSAO_INTEGRAL',
  'SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO'
);

CREATE TYPE "StatusTenantProduto" AS ENUM (
  'PENDENTE',
  'ATIVO',
  'SUSPENSO_FINANCEIRO',
  'SUSPENSO_OPERACIONAL',
  'CANCELADO'
);

CREATE TABLE "Produto" (
  "codigo" VARCHAR(30) NOT NULL,
  "nome" TEXT NOT NULL,
  "metricaCobranca" VARCHAR(40) NOT NULL,
  "politicaAcessoInadimplencia" "PoliticaAcessoInadimplencia" NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Produto_pkey" PRIMARY KEY ("codigo")
);

INSERT INTO "Produto" (
  "codigo", "nome", "metricaCobranca", "politicaAcessoInadimplencia", "atualizadoEm"
) VALUES
  ('sysbelt', 'SysBelt', 'ALUNOS_ATIVOS', 'SUSPENSAO_INTEGRAL', CURRENT_TIMESTAMP),
  ('mecanix', 'Mecanix', 'PLANO_UNIDADE', 'SUSPENSAO_INTEGRAL', CURRENT_TIMESTAMP),
  ('psyche', 'Psyché', 'PROFISSIONAIS_ATIVOS', 'SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO', CURRENT_TIMESTAMP);

ALTER TABLE "Plano" ADD COLUMN "produtoCodigo" VARCHAR(30) NOT NULL DEFAULT 'sysbelt';
ALTER TABLE "Assinatura" ADD COLUMN "produtoCodigo" VARCHAR(30) NOT NULL DEFAULT 'sysbelt';

DROP INDEX "Plano_nome_key";
CREATE UNIQUE INDEX "Plano_produtoCodigo_nome_key" ON "Plano"("produtoCodigo", "nome");
CREATE INDEX "Plano_produtoCodigo_ativo_idx" ON "Plano"("produtoCodigo", "ativo");
CREATE INDEX "Assinatura_produtoCodigo_status_idx" ON "Assinatura"("produtoCodigo", "status");

ALTER TABLE "Plano" ADD CONSTRAINT "Plano_produtoCodigo_fkey"
  FOREIGN KEY ("produtoCodigo") REFERENCES "Produto"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_produtoCodigo_fkey"
  FOREIGN KEY ("produtoCodigo") REFERENCES "Produto"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "Assinatura_assinanteId_corrente_key";
CREATE UNIQUE INDEX "Assinatura_assinanteId_produtoCodigo_corrente_key"
  ON "Assinatura"("assinanteId", "produtoCodigo") WHERE "encerradaEm" IS NULL;

CREATE TABLE "TenantProduto" (
  "id" UUID NOT NULL,
  "produtoCodigo" VARCHAR(30) NOT NULL,
  "assinanteId" UUID NOT NULL,
  "slug" VARCHAR(63) NOT NULL,
  "tenantKey" UUID NOT NULL,
  "status" "StatusTenantProduto" NOT NULL DEFAULT 'PENDENTE',
  "secretRef" TEXT,
  "schemaVersaoAtual" TEXT,
  "credentialVersion" INTEGER NOT NULL DEFAULT 1,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantProduto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantProduto_tenantKey_key" ON "TenantProduto"("tenantKey");
CREATE UNIQUE INDEX "TenantProduto_produtoCodigo_slug_key" ON "TenantProduto"("produtoCodigo", "slug");
CREATE UNIQUE INDEX "TenantProduto_produtoCodigo_assinanteId_key" ON "TenantProduto"("produtoCodigo", "assinanteId");
CREATE INDEX "TenantProduto_assinanteId_status_idx" ON "TenantProduto"("assinanteId", "status");
ALTER TABLE "TenantProduto" ADD CONSTRAINT "TenantProduto_produtoCodigo_fkey"
  FOREIGN KEY ("produtoCodigo") REFERENCES "Produto"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantProduto" ADD CONSTRAINT "TenantProduto_assinanteId_fkey"
  FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Compatibilidade: materializa o ambiente SysBelt já existente no novo diretório.
INSERT INTO "TenantProduto" (
  "id", "produtoCodigo", "assinanteId", "slug", "tenantKey", "status",
  "secretRef", "schemaVersaoAtual", "credentialVersion", "criadoEm", "atualizadoEm"
)
SELECT
  gen_random_uuid(), 'sysbelt', a."id", a."slug", ambiente."tenantKey",
  CASE ambiente."status"::text
    WHEN 'ATIVO' THEN 'ATIVO'::"StatusTenantProduto"
    WHEN 'SUSPENSO' THEN 'SUSPENSO_OPERACIONAL'::"StatusTenantProduto"
    WHEN 'DESATIVADO' THEN 'CANCELADO'::"StatusTenantProduto"
    ELSE 'PENDENTE'::"StatusTenantProduto"
  END,
  ambiente."secretRef", ambiente."schemaVersaoAtual",
  COALESCE(ambiente."credentialVersion", 1), ambiente."criadoEm", CURRENT_TIMESTAMP
FROM "AmbienteTenant" ambiente
JOIN "Assinante" a ON a."id" = ambiente."assinanteId";
