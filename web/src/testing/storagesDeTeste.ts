// A suíte roda no ambiente `node` do Vitest, que não tem Web Storage. Em vez
// de trazer jsdom só por causa disso, instalamos os dois storages em memória —
// o código usa apenas getItem/setItem/removeItem, e um objeto simples cobre
// isso sem nenhuma dependência nova.
//
// `localStorage` guarda o que sobrevive a fechar o navegador (sessão, fila
// offline); `sessionStorage` guarda o que vale só para a aba atual, como o
// aviso de sessão expirada.
function criarStorage(): Storage {
  let dados: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(dados).length;
    },
    key: (indice) => Object.keys(dados)[indice] ?? null,
    getItem: (chave) => (chave in dados ? dados[chave] : null),
    setItem: (chave, valor) => {
      dados[chave] = String(valor);
    },
    removeItem: (chave) => {
      delete dados[chave];
    },
    clear: () => {
      dados = {};
    },
  };
}

function instalar(nome: "localStorage" | "sessionStorage"): Storage {
  const storage = criarStorage();
  Object.defineProperty(globalThis, nome, {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

export function instalarStoragesDeTeste() {
  const local = instalar("localStorage");
  const sessao = instalar("sessionStorage");

  return {
    limpar: () => {
      local.clear();
      sessao.clear();
    },
    // Para simular uma chave corrompida ou escrita por fora da aplicação.
    escreverCru: (chave: string, valor: string) => local.setItem(chave, valor),
    escreverCruNaSessao: (chave: string, valor: string) => sessao.setItem(chave, valor),
  };
}
