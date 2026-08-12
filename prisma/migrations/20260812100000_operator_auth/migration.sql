-- CreateEnum
CREATE TYPE "PerfilOperador" AS ENUM ('OPERADOR', 'FINANCEIRO', 'SUPORTE', 'ADMIN_PLATAFORMA');

-- CreateTable
CREATE TABLE "OperadorPlataforma" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilOperador" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versaoToken" INTEGER NOT NULL DEFAULT 1,
    "ultimoLoginEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperadorPlataforma_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OperadorPlataforma_versaoToken_check" CHECK ("versaoToken" > 0),
    CONSTRAINT "OperadorPlataforma_email_normalizado_check" CHECK ("email" = lower(trim("email")))
);

CREATE UNIQUE INDEX "OperadorPlataforma_email_key" ON "OperadorPlataforma"("email");
CREATE INDEX "OperadorPlataforma_ativo_perfil_idx" ON "OperadorPlataforma"("ativo", "perfil");
