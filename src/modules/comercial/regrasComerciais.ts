import { z } from "zod";

const inteiroPositivo = z.number().int().positive();

export const planoVersaoSchema = z
  .object({
    alunosPorBloco: inteiroPositivo,
    precoPorBlocoCentavos: inteiroPositivo,
    blocosMinimosPorUnidade: inteiroPositivo.default(1),
    moeda: z.string().regex(/^[A-Z]{3}$/),
    vigenteDesde: z.date(),
    vigenteAte: z.date().nullable().optional(),
    recursos: z.record(z.string(), z.boolean()),
  })
  .refine(
    ({ vigenteDesde, vigenteAte }) => !vigenteAte || vigenteAte > vigenteDesde,
    { message: "A vigência final precisa ser posterior à inicial.", path: ["vigenteAte"] },
  );

export const assinaturaSchema = z.object({
  diaVencimento: z.number().int().min(1).max(28),
  alunosPorBlocoNegociado: inteiroPositivo.nullish(),
  precoPorBlocoCentavosNegociado: inteiroPositivo.nullish(),
  blocosMinimosPorUnidadeNegociado: inteiroPositivo.nullish(),
});

export const competenciaSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
