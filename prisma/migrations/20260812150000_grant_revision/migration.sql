ALTER TABLE "AmbienteTenant"
ADD COLUMN "revisaoConcessao" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ultimaConcessaoEmitidaEm" TIMESTAMP(3);

ALTER TABLE "AmbienteTenant"
ADD CONSTRAINT "AmbienteTenant_revisao_concessao_check" CHECK ("revisaoConcessao" >= 0);
