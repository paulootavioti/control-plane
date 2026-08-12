-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusAssinante" AS ENUM ('PROSPECT', 'EM_PROVISIONAMENTO', 'ATIVO', 'SUSPENSO', 'CANCELADO', 'ERRO_PROVISIONAMENTO');

-- CreateEnum
CREATE TYPE "TipoContatoAssinante" AS ENUM ('PROPRIETARIO', 'ADMINISTRATIVO', 'FINANCEIRO', 'TECNICO');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('TESTE', 'ATIVA', 'INADIMPLENTE', 'SUSPENSA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('RASCUNHO', 'ABERTA', 'PAGA', 'VENCIDA', 'CANCELADA', 'ESTORNADA');

-- CreateTable
CREATE TABLE "Assinante" (
    "id" UUID NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "documento" TEXT NOT NULL,
    "emailCobranca" TEXT NOT NULL,
    "telefone" TEXT,
    "slug" TEXT NOT NULL,
    "status" "StatusAssinante" NOT NULL DEFAULT 'PROSPECT',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assinante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContatoAssinante" (
    "id" UUID NOT NULL,
    "assinanteId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "tipo" "TipoContatoAssinante" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContatoAssinante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plano" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoVersao" (
    "id" UUID NOT NULL,
    "planoId" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteAte" TIMESTAMP(3),
    "alunosPorBloco" INTEGER NOT NULL,
    "precoPorBlocoCentavos" INTEGER NOT NULL,
    "blocosMinimosPorUnidade" INTEGER NOT NULL DEFAULT 1,
    "moeda" CHAR(3) NOT NULL DEFAULT 'BRL',
    "recursos" JSONB NOT NULL,
    "metadadosComerciais" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanoVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assinatura" (
    "id" UUID NOT NULL,
    "assinanteId" UUID NOT NULL,
    "planoVersaoId" UUID NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'TESTE',
    "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testeAte" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "alunosPorBlocoNegociado" INTEGER,
    "precoPorBlocoCentavosNegociado" INTEGER,
    "blocosMinimosPorUnidadeNegociado" INTEGER,
    "politicaCobranca" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fatura" (
    "id" UUID NOT NULL,
    "assinanteId" UUID NOT NULL,
    "assinaturaId" UUID NOT NULL,
    "competencia" VARCHAR(7) NOT NULL,
    "vencimentoEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'RASCUNHO',
    "subtotalCentavos" INTEGER NOT NULL,
    "descontoCentavos" INTEGER NOT NULL DEFAULT 0,
    "acrescimoCentavos" INTEGER NOT NULL DEFAULT 0,
    "totalCentavos" INTEGER NOT NULL,
    "moeda" CHAR(3) NOT NULL DEFAULT 'BRL',
    "planoSnapshot" JSONB NOT NULL,
    "condicoesSnapshot" JSONB,
    "gateway" TEXT,
    "gatewayFaturaId" TEXT,
    "emitidaEm" TIMESTAMP(3),
    "pagaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "estornadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaturaItem" (
    "id" UUID NOT NULL,
    "faturaId" UUID NOT NULL,
    "tenantUnidadeId" TEXT NOT NULL,
    "nomeUnidade" TEXT NOT NULL,
    "alunosAtivos" INTEGER NOT NULL,
    "alunosPorBloco" INTEGER NOT NULL,
    "blocosCobrados" INTEGER NOT NULL,
    "precoPorBlocoCentavos" INTEGER NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assinante_documento_key" ON "Assinante"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Assinante_slug_key" ON "Assinante"("slug");

-- CreateIndex
CREATE INDEX "Assinante_status_idx" ON "Assinante"("status");

-- CreateIndex
CREATE INDEX "ContatoAssinante_assinanteId_tipo_idx" ON "ContatoAssinante"("assinanteId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Plano_nome_key" ON "Plano"("nome");

-- CreateIndex
CREATE INDEX "PlanoVersao_planoId_vigenteDesde_idx" ON "PlanoVersao"("planoId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoVersao_planoId_versao_key" ON "PlanoVersao"("planoId", "versao");

-- CreateIndex
CREATE INDEX "Assinatura_assinanteId_status_idx" ON "Assinatura"("assinanteId", "status");

-- CreateIndex
CREATE INDEX "Assinatura_planoVersaoId_idx" ON "Assinatura"("planoVersaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_id_assinanteId_key" ON "Assinatura"("id", "assinanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_gatewayFaturaId_key" ON "Fatura"("gatewayFaturaId");

-- CreateIndex
CREATE INDEX "Fatura_assinanteId_status_idx" ON "Fatura"("assinanteId", "status");

-- CreateIndex
CREATE INDEX "Fatura_vencimentoEm_status_idx" ON "Fatura"("vencimentoEm", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_assinaturaId_competencia_key" ON "Fatura"("assinaturaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "FaturaItem_faturaId_tenantUnidadeId_key" ON "FaturaItem"("faturaId", "tenantUnidadeId");

-- AddForeignKey
ALTER TABLE "ContatoAssinante" ADD CONSTRAINT "ContatoAssinante_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoVersao" ADD CONSTRAINT "PlanoVersao_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_planoVersaoId_fkey" FOREIGN KEY ("planoVersaoId") REFERENCES "PlanoVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_assinaturaId_assinanteId_fkey" FOREIGN KEY ("assinaturaId", "assinanteId") REFERENCES "Assinatura"("id", "assinanteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaturaItem" ADD CONSTRAINT "FaturaItem_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regras de integridade que o Prisma não expressa no schema.
CREATE UNIQUE INDEX "ContatoAssinante_um_principal_por_assinante"
ON "ContatoAssinante" ("assinanteId") WHERE "principal" = true;

CREATE UNIQUE INDEX "Assinatura_uma_corrente_por_assinante"
ON "Assinatura" ("assinanteId") WHERE "encerradaEm" IS NULL;

ALTER TABLE "PlanoVersao"
ADD CONSTRAINT "PlanoVersao_valores_positivos_check" CHECK (
  "versao" > 0 AND
  "alunosPorBloco" > 0 AND
  "precoPorBlocoCentavos" > 0 AND
  "blocosMinimosPorUnidade" > 0 AND
  ("vigenteAte" IS NULL OR "vigenteAte" > "vigenteDesde")
);

ALTER TABLE "Assinatura"
ADD CONSTRAINT "Assinatura_condicoes_validas_check" CHECK (
  "diaVencimento" BETWEEN 1 AND 28 AND
  ("testeAte" IS NULL OR "testeAte" >= "inicioEm") AND
  ("canceladaEm" IS NULL OR "canceladaEm" >= "inicioEm") AND
  ("encerradaEm" IS NULL OR "encerradaEm" >= "inicioEm") AND
  ("alunosPorBlocoNegociado" IS NULL OR "alunosPorBlocoNegociado" > 0) AND
  ("precoPorBlocoCentavosNegociado" IS NULL OR "precoPorBlocoCentavosNegociado" > 0) AND
  ("blocosMinimosPorUnidadeNegociado" IS NULL OR "blocosMinimosPorUnidadeNegociado" > 0)
);

ALTER TABLE "Fatura"
ADD CONSTRAINT "Fatura_competencia_check"
CHECK ("competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "Fatura"
ADD CONSTRAINT "Fatura_valores_check" CHECK (
  "subtotalCentavos" >= 0 AND
  "descontoCentavos" >= 0 AND
  "acrescimoCentavos" >= 0 AND
  "totalCentavos" >= 0 AND
  "totalCentavos" = "subtotalCentavos" - "descontoCentavos" + "acrescimoCentavos"
);

ALTER TABLE "FaturaItem"
ADD CONSTRAINT "FaturaItem_calculo_check" CHECK (
  "alunosAtivos" >= 0 AND
  "alunosPorBloco" > 0 AND
  "blocosCobrados" > 0 AND
  "precoPorBlocoCentavos" > 0 AND
  "valorCentavos" = "blocosCobrados" * "precoPorBlocoCentavos"
);
