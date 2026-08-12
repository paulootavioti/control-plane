ALTER TABLE "AmbienteTenant" ADD COLUMN "chavePublicaIntegracao" TEXT;

ALTER TABLE "AmbienteTenant"
ADD CONSTRAINT "AmbienteTenant_chave_publica_check" CHECK (
  "chavePublicaIntegracao" IS NULL OR
  (
    "chavePublicaIntegracao" LIKE '-----BEGIN PUBLIC KEY-----%' AND
    "chavePublicaIntegracao" NOT ILIKE '%PRIVATE KEY%'
  )
);
