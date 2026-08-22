CREATE TYPE "StatusExecucaoWorkerBilling" AS ENUM ('EXECUTANDO', 'SUCESSO', 'PARCIAL', 'FALHOU');

CREATE TABLE "ExecucaoWorkerBilling" (
  "id" UUID NOT NULL,
  "status" "StatusExecucaoWorkerBilling" NOT NULL DEFAULT 'EXECUTANDO',
  "limite" INTEGER NOT NULL,
  "eventos" INTEGER NOT NULL DEFAULT 0,
  "dunning" INTEGER NOT NULL DEFAULT 0,
  "reconciliacoes" INTEGER NOT NULL DEFAULT 0,
  "notificacoes" INTEGER NOT NULL DEFAULT 0,
  "falhas" INTEGER NOT NULL DEFAULT 0,
  "erroSanitizado" TEXT,
  "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluidoEm" TIMESTAMP(3),
  CONSTRAINT "ExecucaoWorkerBilling_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecucaoWorkerBilling_iniciadoEm_idx" ON "ExecucaoWorkerBilling"("iniciadoEm");
CREATE INDEX "ExecucaoWorkerBilling_status_iniciadoEm_idx" ON "ExecucaoWorkerBilling"("status", "iniciadoEm");
