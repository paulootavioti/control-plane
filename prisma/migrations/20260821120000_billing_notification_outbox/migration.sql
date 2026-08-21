CREATE TYPE "StatusNotificacaoBilling" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHOU', 'CANCELADA');
ALTER TYPE "StatusTentativaDunning" ADD VALUE IF NOT EXISTS 'EXECUTANDO';
ALTER TYPE "StatusEventoWebhook" ADD VALUE IF NOT EXISTS 'PROCESSANDO';
ALTER TABLE "EventoWebhookPagamento" ADD COLUMN "processamentoIniciadoEm" TIMESTAMP(3);
ALTER TABLE "TentativaDunning" ADD COLUMN "execucaoIniciadaEm" TIMESTAMP(3);

CREATE TABLE "NotificacaoBilling" (
  "id" UUID NOT NULL,
  "assinaturaId" UUID NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "tipo" VARCHAR(60) NOT NULL,
  "destinatario" TEXT NOT NULL,
  "dados" JSONB NOT NULL,
  "status" "StatusNotificacaoBilling" NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadaEm" TIMESTAMP(3),
  "erroSanitizado" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificacaoBilling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificacaoBilling_chaveIdempotencia_key"
  ON "NotificacaoBilling"("chaveIdempotencia");
CREATE INDEX "NotificacaoBilling_status_proximaTentativaEm_idx"
  ON "NotificacaoBilling"("status", "proximaTentativaEm");
ALTER TABLE "NotificacaoBilling" ADD CONSTRAINT "NotificacaoBilling_assinaturaId_fkey"
  FOREIGN KEY ("assinaturaId") REFERENCES "Assinatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
