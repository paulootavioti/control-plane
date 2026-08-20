export interface PlanoVersao {
  id: string;
  versao: number;
  alunosPorBloco: number;
  precoPorBlocoCentavos: number;
  blocosMinimosPorUnidade: number;
  moeda: string;
  recursos: unknown;
  plano: { id: string; nome: string; descricao: string | null };
}

export interface Assinatura {
  id: string;
  status: string;
  inicioEm: string;
  testeAte: string | null;
  canceladaEm: string | null;
  diaVencimento: number;
  alunosPorBlocoNegociado: number | null;
  precoPorBlocoCentavosNegociado: number | null;
  blocosMinimosPorUnidadeNegociado: number | null;
  planoVersao: PlanoVersao;
}

export interface ValorVigente {
  valor: number;
  negociado: boolean;
}

export interface ValoresVigentes {
  alunosPorBloco: ValorVigente;
  precoPorBlocoCentavos: ValorVigente;
  blocosMinimosPorUnidade: ValorVigente;
}

// Uma assinatura pode ter condição negociada por campo. Onde ela existe, é ela
// que vale — o preço de tabela do plano deixa de se aplicar àquela conta.
//
// A tela precisa mostrar os dois fatos juntos: quanto vale hoje, e se aquilo
// veio de uma negociação. Exibir só o valor esconderia que houve acordo, e
// exibir só o de tabela mostraria um preço que ninguém está pagando.
//
// `null` significa "sem negociação" e cai no valor do plano. A checagem é por
// `null`, nunca por falsidade — `??` e não `||`.
//
// Hoje a API não deixa gravar zero (`z.number().int().positive()`), então essa
// distinção é defesa, não caso de uso: se um zero chegar por outro caminho
// (carga direta no banco, mudança futura no schema), a tela mostra o zero
// gravado em vez de inventar o preço de tabela que ninguém combinou.
function escolher(negociado: number | null, doPlano: number): ValorVigente {
  return negociado === null
    ? { valor: doPlano, negociado: false }
    : { valor: negociado, negociado: true };
}

export function valoresVigentes(assinatura: Assinatura): ValoresVigentes {
  const { planoVersao } = assinatura;

  return {
    alunosPorBloco: escolher(assinatura.alunosPorBlocoNegociado, planoVersao.alunosPorBloco),
    precoPorBlocoCentavos: escolher(
      assinatura.precoPorBlocoCentavosNegociado,
      planoVersao.precoPorBlocoCentavos
    ),
    blocosMinimosPorUnidade: escolher(
      assinatura.blocosMinimosPorUnidadeNegociado,
      planoVersao.blocosMinimosPorUnidade
    ),
  };
}

// Quanto a conta custaria no mês, dadas as contagens de alunos por unidade.
//
// Espelha `precoPlataforma.ts` do tenant: teto por aritmética inteira, e não
// `Math.ceil` sobre divisão em ponto flutuante — dividir em binário pode
// devolver uma faixa a mais quando a divisão não é exata, e uma faixa a mais é
// dinheiro cobrado a mais.
export function calcularBlocos(
  alunosPorUnidade: number[],
  { alunosPorBloco, blocosMinimosPorUnidade }: { alunosPorBloco: number; blocosMinimosPorUnidade: number }
): number {
  if (alunosPorBloco <= 0) return 0;

  return alunosPorUnidade.reduce((total, alunos) => {
    const necessarios = Math.floor((Math.max(alunos, 0) + alunosPorBloco - 1) / alunosPorBloco);
    return total + Math.max(blocosMinimosPorUnidade, necessarios);
  }, 0);
}
