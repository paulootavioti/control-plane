ALTER TYPE "StatusNotificacaoBilling" ADD VALUE IF NOT EXISTS 'PROCESSANDO';
ALTER TABLE "NotificacaoBilling" ADD COLUMN "processamentoIniciadoEm" TIMESTAMP(3);
