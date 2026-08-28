// Este script só roda fora do Netlify, então depende do .env para achar o
// banco. Ver o comentário em server.ts.
import "dotenv/config";

import { operadorInicialSchema, criarSenhaHash } from "../modules/auth/regrasAuth";
import { prisma } from "../shared/prisma";
import { CriarOperadorInicialService } from "../modules/operadores/CriarOperadorInicialService";

async function main() {
  const dados = operadorInicialSchema.parse({
    nome: process.env.CONTROL_PLANE_ADMIN_NAME,
    email: process.env.CONTROL_PLANE_ADMIN_EMAIL,
    senha: process.env.CONTROL_PLANE_ADMIN_PASSWORD,
  });

  const resultado = await new CriarOperadorInicialService(prisma).execute({
    nome: dados.nome,
    email: dados.email,
    senhaHash: await criarSenhaHash(dados.senha),
  });
  console.log(resultado.criado
    ? "Operador administrador inicial criado."
    : "Operador administrador inicial já estava configurado.");
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : "Falha ao criar operador.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
