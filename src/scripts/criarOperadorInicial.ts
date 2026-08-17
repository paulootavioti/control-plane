// Este script só roda fora do Netlify, então depende do .env para achar o
// banco. Ver o comentário em server.ts.
import "dotenv/config";

import { PerfilOperador } from "@prisma/client";

import { operadorInicialSchema, criarSenhaHash } from "../modules/auth/regrasAuth";
import { prisma } from "../shared/prisma";

async function main() {
  const dados = operadorInicialSchema.parse({
    nome: process.env.CONTROL_PLANE_ADMIN_NAME,
    email: process.env.CONTROL_PLANE_ADMIN_EMAIL,
    senha: process.env.CONTROL_PLANE_ADMIN_PASSWORD,
  });

  const existente = await prisma.operadorPlataforma.findUnique({ where: { email: dados.email } });
  if (existente) {
    throw new Error("Já existe um operador com este e-mail.");
  }

  await prisma.operadorPlataforma.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      senhaHash: await criarSenhaHash(dados.senha),
      perfil: PerfilOperador.ADMIN_PLATAFORMA,
    },
  });

  console.log("Operador administrador inicial criado.");
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : "Falha ao criar operador.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
