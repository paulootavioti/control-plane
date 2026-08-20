import axios from "axios";

import { marcarSessaoExpirada } from "../utils/sessaoExpirada";
import { criarInterceptorDeExpiracao } from "../utils/expiracaoDeSessao";

// Em produção este app é servido pelo MESMO site do Control Plane, então "/api"
// resolve na própria origem — sem CORS e sem variável de ambiente para
// configurar. Em desenvolvimento, o proxy do Vite manda "/api" para a API
// local na 3334 (ver vite.config.ts).
export const api = axios.create({
  baseURL: "/api",
});

// O interceptor é registrado uma vez, aqui. Quem reage à expiração é definido
// depois pelo AuthContext — ele é quem sabe limpar a sessão, e importá-lo
// deste arquivo criaria um ciclo, já que o contexto usa a `api`.
let aoExpirarSessao: () => void = () => {};

export function registrarExpiracaoDeSessao(callback: () => void) {
  aoExpirarSessao = callback;
}

api.interceptors.response.use(
  (resposta) => resposta,
  criarInterceptorDeExpiracao(() => {
    // Marca antes de deslogar: o logout dispara o redirecionamento, e a tela
    // de login precisa encontrar o aviso já gravado quando montar.
    marcarSessaoExpirada();
    aoExpirarSessao();
  })
);
