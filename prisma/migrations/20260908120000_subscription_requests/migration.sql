CREATE TYPE "IntencaoSolicitacaoAssinatura" AS ENUM ('TESTE', 'ASSINATURA_IMEDIATA');
CREATE TYPE "StatusSolicitacaoAssinatura" AS ENUM ('RECEBIDA', 'APROVADA', 'RECUSADA', 'CONVERTIDA');

-- Operador técnico: não autentica e existe apenas para manter a FK da auditoria.
INSERT INTO "OperadorPlataforma" ("id", "nome", "email", "senhaHash", "perfil", "ativo", "atualizadoEm")
VALUES ('00000000-0000-4000-8000-000000000001', 'Sistema', 'sistema@control-plane.invalid',
  '$2b$12$invalid.invalid.invalid.invalid.invalid.invalid.invalid.invalid',
  'ADMIN_PLATAFORMA', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Assinante" ADD COLUMN "produtoCodigo" VARCHAR(30);
UPDATE "Assinante" SET "produtoCodigo" = 'sysbelt' WHERE "produtoCodigo" IS NULL;
ALTER TABLE "Assinante" ALTER COLUMN "produtoCodigo" SET NOT NULL;
CREATE INDEX "Assinante_produtoCodigo_status_idx" ON "Assinante"("produtoCodigo", "status");
ALTER TABLE "Assinante" ADD CONSTRAINT "Assinante_produtoCodigo_fkey"
  FOREIGN KEY ("produtoCodigo") REFERENCES "Produto"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agora que cada assinante pertence a exatamente um produto, a unicidade volta
-- a proteger globalmente uma única assinatura corrente por assinante.
DROP INDEX "Assinatura_assinanteId_produtoCodigo_corrente_key";
CREATE UNIQUE INDEX "Assinatura_assinanteId_corrente_key"
  ON "Assinatura"("assinanteId") WHERE "encerradaEm" IS NULL;

CREATE TABLE "SolicitacaoAssinatura" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "produtoId" VARCHAR(30) NOT NULL,
  "intencao" "IntencaoSolicitacaoAssinatura" NOT NULL,
  "nomeOrganizacao" TEXT NOT NULL,
  "documento" TEXT NOT NULL,
  "responsavel" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT,
  "origem" JSONB,
  "status" "StatusSolicitacaoAssinatura" NOT NULL DEFAULT 'RECEBIDA',
  "motivo" TEXT,
  "assinanteId" UUID,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decididoEm" TIMESTAMP(3),
  "decididoPor" UUID,
  CONSTRAINT "SolicitacaoAssinatura_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SolicitacaoAssinatura_produtoId_status_criadoEm_idx" ON "SolicitacaoAssinatura"("produtoId", "status", "criadoEm");
CREATE INDEX "SolicitacaoAssinatura_status_intencao_criadoEm_idx" ON "SolicitacaoAssinatura"("status", "intencao", "criadoEm");
CREATE INDEX "SolicitacaoAssinatura_documento_idx" ON "SolicitacaoAssinatura"("documento");
ALTER TABLE "SolicitacaoAssinatura" ADD CONSTRAINT "SolicitacaoAssinatura_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoAssinatura" ADD CONSTRAINT "SolicitacaoAssinatura_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SolicitacaoAssinatura" ADD CONSTRAINT "SolicitacaoAssinatura_decididoPor_fkey" FOREIGN KEY ("decididoPor") REFERENCES "OperadorPlataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LimiteSolicitacaoPublica" (
  "chave" VARCHAR(200) NOT NULL,
  "janela" TIMESTAMP(3) NOT NULL,
  "quantidade" INTEGER NOT NULL DEFAULT 0,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LimiteSolicitacaoPublica_pkey" PRIMARY KEY ("chave")
);
CREATE INDEX "LimiteSolicitacaoPublica_janela_idx" ON "LimiteSolicitacaoPublica"("janela");
