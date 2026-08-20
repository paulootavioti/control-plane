const CHAVE = "@sysbelt:sessaoExpirada";

export const MENSAGEM_SESSAO_EXPIRADA =
  "Sua sessão expirou. Entre novamente para continuar.";

// `sessionStorage`, não `localStorage`: o aviso vale para a aba em que a
// sessão caiu. Guardado no localStorage, ele reapareceria dias depois, numa
// janela nova, sem relação com o que aconteceu.
export function marcarSessaoExpirada() {
  sessionStorage.setItem(CHAVE, "1");
}

export function lerSessaoExpirada(): string | null {
  return sessionStorage.getItem(CHAVE) === null ? null : MENSAGEM_SESSAO_EXPIRADA;
}

// Ler e limpar são separados de propósito. Fossem uma coisa só, o inicializador
// de `useState` — que o React chama duas vezes em modo estrito — consumiria a
// marca na primeira chamada e a tela ficaria sem o aviso.
export function limparSessaoExpirada() {
  sessionStorage.removeItem(CHAVE);
}
