import { AxiosError } from "axios";

// Todo 401 que um navegador recebe deste backend significa sessão
// inutilizável: token ausente, token inválido, usuário que sumiu ou escopo
// vazio (o caso do aluno que completou 18 anos e saiu da lista do
// responsável).
//
// Falta de permissão devolve 403 e login recusado devolve 400 — os únicos
// outros 401 do backend são de cron e de dispositivo de catraca, que nenhum
// navegador alcança. Por isso não há rota a excluir daqui: se veio 401, a
// sessão acabou.
// A rota de login é a exceção, e é por isso que este arquivo não é cópia do
// que existe nos frontends do tenant: aquela API devolve 400 para credencial
// recusada, enquanto o Control Plane devolve 401
// (`modules/auth/routes.ts`: "E-mail ou senha inválidos.").
//
// Sem excluí-la, uma tentativa de login com senha errada marcaria a sessão
// como expirada — e o aviso "Sua sessão expirou" apareceria na abertura
// seguinte da tela de login, sem que sessão alguma tivesse existido.
const ROTA_DE_LOGIN = "/auth/login";

export function ehSessaoExpirada(erro: unknown): boolean {
  if (!(erro instanceof AxiosError) || erro.response?.status !== 401) return false;
  return !erro.config?.url?.endsWith(ROTA_DE_LOGIN);
}

// O erro segue rejeitado depois de avisar. Engoli-lo faria a tela que fez a
// chamada esperar para sempre por uma resposta que não vem.
export function criarInterceptorDeExpiracao(aoExpirar: () => void) {
  return (erro: unknown) => {
    if (ehSessaoExpirada(erro)) {
      aoExpirar();
    }
    return Promise.reject(erro);
  };
}
