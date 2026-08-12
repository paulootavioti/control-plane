import { z } from "zod";

export const contagemContratoV1Schema = z.object({
  versao: z.literal(1),
  eventoId: z.string().uuid(),
  tenantKey: z.string().uuid(),
  dataCorte: z.string().datetime({ offset: true }),
  unidades: z.array(z.object({
    unidadeId: z.string().trim().min(1).max(200),
    nomeExibicao: z.string().trim().min(1).max(200),
    status: z.enum(["ATIVA", "ENCERRADA"]),
    alunosAtivos: z.number().int().nonnegative(),
  }).strict()).min(1).max(1000),
}).strict().superRefine(({ unidades }, contexto) => {
  const ids = new Set<string>();
  unidades.forEach((unidade, indice) => {
    if (ids.has(unidade.unidadeId)) {
      contexto.addIssue({
        code: "custom",
        message: "A mesma unidade não pode aparecer duas vezes.",
        path: ["unidades", indice, "unidadeId"],
      });
    }
    ids.add(unidade.unidadeId);
  });
});

export type ContagemContratoV1 = z.infer<typeof contagemContratoV1Schema>;
