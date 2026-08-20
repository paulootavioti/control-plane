import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { api, registrarExpiracaoDeSessao } from "../services/api";
import { gravarSessao, lerSessao, limparSessao, perfilAlcanca } from "../utils/sessaoOperador";
import { AuthContext } from "./authContextData";
import type { Operador, PerfilOperador } from "./authContextData";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [sessaoInicial] = useState(lerSessao);

  const [operador, setOperador] = useState<Operador | null>(sessaoInicial.operador);

  const [token, setToken] = useState<string | null>(() => {
    if (sessaoInicial.token) {
      api.defaults.headers.common.Authorization = `Bearer ${sessaoInicial.token}`;
    }
    return sessaoInicial.token;
  });

  async function login(email: string, senha: string) {
    const resposta = await api.post("/auth/login", { email, senha });
    const { operador: operadorLogado, token: tokenRecebido } = resposta.data;

    gravarSessao(operadorLogado, tokenRecebido);
    api.defaults.headers.common.Authorization = `Bearer ${tokenRecebido}`;

    setOperador(operadorLogado);
    setToken(tokenRecebido);
  }

  function logout() {
    limparSessao();
    delete api.defaults.headers.common.Authorization;

    setOperador(null);
    setToken(null);
  }

  function podeVer(perfis: PerfilOperador[]) {
    return perfilAlcanca(operador?.perfil, perfis);
  }

  // O interceptor da `api` não conhece a sessão; é aqui que ele passa a saber
  // o que fazer quando o backend recusa o token.
  useEffect(() => {
    registrarExpiracaoDeSessao(logout);
  });

  return (
    <AuthContext.Provider value={{ operador, token, login, logout, podeVer }}>
      {children}
    </AuthContext.Provider>
  );
}
