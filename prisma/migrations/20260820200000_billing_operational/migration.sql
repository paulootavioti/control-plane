CREATE TYPE "StatusEventoWebhook" AS ENUM ('RECEBIDO', 'PROCESSADO', 'FALHOU');
CREATE TYPE "StatusTentativaDunning" AS ENUM ('PENDENTE', 'EXECUTADA', 'CANCELADA', 'FALHOU');
CREATE TYPE "StatusDocumentoFiscal" AS ENUM ('PENDENTE', 'EMITIDO', 'CANCELADO', 'FALHOU');

ALTER TABLE "Assinatura"
  ADD COLUMN "gateway" TEXT,
  ADD COLUMN "gatewayClienteId" TEXT,
  ADD COLUMN "gatewayAssinaturaId" TEXT,
  ADD COLUMN "primeiraFalhaPagamentoEm" TIMESTAMP(3);
CREATE UNIQUE INDEX "Assinatura_gatewayAssinaturaId_key" ON "Assinatura"("gatewayAssinaturaId");

CREATE TABLE "EventoWebhookPagamento" (
  "id" UUID NOT NULL,
  "provedor" VARCHAR(30) NOT NULL,
  "eventoExternoId" TEXT NOT NULL,
  "tipo" VARCHAR(80) NOT NULL,
  "acao" VARCHAR(100) NOT NULL,
  "payloadBruto" JSONB NOT NULL,
  "status" "StatusEventoWebhook" NOT NULL DEFAULT 'RECEBIDO',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "erroSanitizado" TEXT,
  "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processadoEm" TIMESTAMP(3),
  CONSTRAINT "EventoWebhookPagamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoWebhookPagamento_provedor_eventoExternoId_key"
  ON "EventoWebhookPagamento"("provedor", "eventoExternoId");
CREATE INDEX "EventoWebhookPagamento_status_recebidoEm_idx"
  ON "EventoWebhookPagamento"("status", "recebidoEm");

CREATE TABLE "TentativaDunning" (
  "id" UUID NOT NULL,
  "assinaturaId" UUID NOT NULL,
  "diaRegua" INTEGER NOT NULL,
  "acao" VARCHAR(40) NOT NULL,
  "status" "StatusTentativaDunning" NOT NULL DEFAULT 'PENDENTE',
  "agendadaPara" TIMESTAMP(3) NOT NULL,
  "executadaEm" TIMESTAMP(3),
  "erroSanitizado" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TentativaDunning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TentativaDunning_assinaturaId_diaRegua_key"
  ON "TentativaDunning"("assinaturaId", "diaRegua");
CREATE INDEX "TentativaDunning_status_agendadaPara_idx"
  ON "TentativaDunning"("status", "agendadaPara");
ALTER TABLE "TentativaDunning" ADD CONSTRAINT "TentativaDunning_assinaturaId_fkey"
  FOREIGN KEY ("assinaturaId") REFERENCES "Assinatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentoFiscal" (
  "id" UUID NOT NULL,
  "faturaId" UUID NOT NULL,
  "status" "StatusDocumentoFiscal" NOT NULL DEFAULT 'PENDENTE',
  "provedor" TEXT,
  "referenciaExterna" TEXT,
  "payloadSolicitacao" JSONB,
  "emitidoEm" TIMESTAMP(3),
  "canceladoEm" TIMESTAMP(3),
  "erroSanitizado" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentoFiscal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentoFiscal_faturaId_key" ON "DocumentoFiscal"("faturaId");
CREATE UNIQUE INDEX "DocumentoFiscal_referenciaExterna_key" ON "DocumentoFiscal"("referenciaExterna");
ALTER TABLE "DocumentoFiscal" ADD CONSTRAINT "DocumentoFiscal_faturaId_fkey"
  FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
