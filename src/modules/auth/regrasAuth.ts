import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(8).max(128),
});

export const operadorInicialSchema = loginSchema.extend({
  nome: z.string().trim().min(2).max(120),
});

export type TokenOperador = {
  sub: string;
  perfil: "OPERADOR" | "FINANCEIRO" | "SUPORTE" | "ADMIN_PLATAFORMA";
  versao: number;
};

export function criarSenhaHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function emitirToken(payload: TokenOperador, segredo: string): string {
  return jwt.sign(payload, segredo, {
    algorithm: "HS256",
    expiresIn: "8h",
    issuer: "sysbelt-control-plane",
    audience: "sysbelt-control-plane-operator",
  });
}

export function verificarToken(token: string, segredo: string): TokenOperador {
  const payload = jwt.verify(token, segredo, {
    algorithms: ["HS256"],
    issuer: "sysbelt-control-plane",
    audience: "sysbelt-control-plane-operator",
  });

  if (typeof payload === "string" || !payload.sub || !payload.perfil || !payload.versao) {
    throw new Error("Token de operador inválido.");
  }

  return payload as TokenOperador;
}
