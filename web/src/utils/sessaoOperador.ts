import type { Operador, PerfilOperador } from "../contexts/authContextData";

export const CHAVE_OPERADOR = "@controlPlane:operador";
export const CHAVE_TOKEN = "@controlPlane:token";

const PERFIS: readonly PerfilOperador[] = [
  "OPERADOR",
  "FINANCEIRO",
  "SUPORTE",
  "ADMIN_PLATAFORMA",
];

export interface SessaoOperador {
  operador: Operador | null;
  token: string | null;
}

// O que veio do storage é entrada não confiável: pode ter sido escrito por uma
// versão anterior do app, ou editado à mão. Um objeto sem perfil válido faria
// `podeVer` decidir com base em `undefined`, e a decisão de mostrar ou esconder
// tela viraria acidente.
function ehOperador(valor: unknown): valor is Operador {
  if (typeof valor !== "object" || valor === null) return false;
  const candidato = valor as Record<string, unknown>;
  return (
    typeof candidato.id === "string" &&
    typeof candidato.nome === "string" &&
    typeof candidato.email === "string" &&
    PERFIS.includes(candidato.perfil as PerfilOperador)
  );
}

export function lerSessao(): SessaoOperador {
  const bruto = localStorage.getItem(CHAVE_OPERADOR);
  const token = localStorage.getItem(CHAVE_TOKEN);

  if (!bruto || !token) return { operador: null, token: null };

  try {
    const valor: unknown = JSON.parse(bruto);
    // Sem operador válido não há sessão: guardar o token sozinho deixaria o
    // app "logado" sem saber quem é nem o que pode ver.
    return ehOperador(valor) ? { operador: valor, token } : { operador: null, token: null };
  } catch {
    return { operador: null, token: null };
  }
}

export function gravarSessao(operador: Operador, token: string) {
  localStorage.setItem(CHAVE_OPERADOR, JSON.stringify(operador));
  localStorage.setItem(CHAVE_TOKEN, token);
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_OPERADOR);
  localStorage.removeItem(CHAVE_TOKEN);
}

// O backend é quem autoriza de verdade — cada rota tem seu
// `autenticarOperador([...])`. Isto existe só para não oferecer ao operador uma
// tela que o servidor vai recusar.
export function perfilAlcanca(perfil: PerfilOperador | undefined, permitidos: PerfilOperador[]) {
  if (!perfil) return false;
  if (permitidos.length === 0) return true;
  return permitidos.includes(perfil);
}
