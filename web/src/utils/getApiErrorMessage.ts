import { AxiosError } from "axios";

import { ErroDeUsuario } from "./ErroDeUsuario";

// A API do Control Plane devolve `{ mensagem }`, e não `{ message }` como a do
// tenant. É a única diferença em relação à versão dos outros três frontends —
// por isso este arquivo não é cópia daqueles: unificá-los exigiria aceitar as
// duas chaves, e aí um erro de contrato numa das APIs passaria despercebido.
interface RespostaDeErro {
  mensagem?: string;
}

export const MENSAGEM_SEM_CONEXAO =
  "Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.";

export function getApiErrorMessage(
  erro: unknown,
  fallback = "Ocorreu um erro inesperado."
) {
  if (erro instanceof AxiosError) {
    if (!erro.response) {
      return MENSAGEM_SEM_CONEXAO;
    }

    const dados = erro.response.data as RespostaDeErro | undefined;
    return dados?.mensagem || fallback;
  }

  if (erro instanceof ErroDeUsuario) {
    return erro.message;
  }

  return fallback;
}
