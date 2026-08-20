CREATE TABLE "AuditLogPlataforma" (
  "id" UUID NOT NULL,
  "operadorId" UUID NOT NULL,
  "assinanteId" UUID,
  "origem" VARCHAR(30) NOT NULL,
  "acao" VARCHAR(100) NOT NULL,
  "alvoTipo" VARCHAR(60) NOT NULL,
  "alvoId" TEXT NOT NULL,
  "mudancas" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLogPlataforma_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLogPlataforma_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "OperadorPlataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AuditLogPlataforma_assinanteId_fkey" FOREIGN KEY ("assinanteId") REFERENCES "Assinante"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuditLogPlataforma_assinanteId_criadoEm_idx" ON "AuditLogPlataforma"("assinanteId", "criadoEm");
CREATE INDEX "AuditLogPlataforma_operadorId_criadoEm_idx" ON "AuditLogPlataforma"("operadorId", "criadoEm");
CREATE INDEX "AuditLogPlataforma_alvoTipo_alvoId_idx" ON "AuditLogPlataforma"("alvoTipo", "alvoId");
