import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { prisma } from "../../shared/prisma";
import { conferirSenha, emitirToken, loginSchema, verificarToken } from "./regrasAuth";

export const authRoutes = Router();

function segredoJwt(): string {
  const segredo = process.env.CONTROL_PLANE_JWT_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error("CONTROL_PLANE_JWT_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return segredo;
}

authRoutes.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  async (request, response) => {
    const validacao = loginSchema.safeParse(request.body);
    if (!validacao.success) {
      return response.status(400).json({ mensagem: "Dados de acesso inválidos." });
    }

    const operador = await prisma.operadorPlataforma.findUnique({ where: { email: validacao.data.email } });
    const senhaValida = operador && await conferirSenha(validacao.data.senha, operador.senhaHash);
    if (!operador || !operador.ativo || !senhaValida) {
      return response.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    }

    await prisma.operadorPlataforma.update({
      where: { id: operador.id },
      data: { ultimoLoginEm: new Date() },
    });

    return response.json({
      token: emitirToken(
        { sub: operador.id, perfil: operador.perfil, versao: operador.versaoToken },
        segredoJwt(),
      ),
      operador: { id: operador.id, nome: operador.nome, email: operador.email, perfil: operador.perfil },
    });
  },
);

authRoutes.get("/me", async (request, response) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({ mensagem: "Autenticação necessária." });
  }

  try {
    const payload = verificarToken(authorization.slice(7), segredoJwt());
    const operador = await prisma.operadorPlataforma.findUnique({ where: { id: payload.sub } });
    if (!operador?.ativo || operador.versaoToken !== payload.versao) {
      return response.status(401).json({ mensagem: "Sessão inválida." });
    }

    return response.json({ id: operador.id, nome: operador.nome, email: operador.email, perfil: operador.perfil });
  } catch {
    return response.status(401).json({ mensagem: "Sessão inválida." });
  }
});
