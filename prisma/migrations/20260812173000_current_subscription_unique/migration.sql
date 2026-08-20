CREATE UNIQUE INDEX "Assinatura_assinanteId_corrente_key"
ON "Assinatura"("assinanteId")
WHERE "encerradaEm" IS NULL;
