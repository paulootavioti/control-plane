export interface FormularioContratacao {
  planoVersaoId: string;
  status: "TESTE" | "ATIVA";
  testeAte: string;
  diaVencimento: string;
  alunosPorBlocoNegociado: string;
  precoPorBlocoNegociadoReais: string;
  blocosMinimosNegociado: string;
}

export const CONTRATACAO_VAZIA: FormularioContratacao = {
  planoVersaoId: "",
  status: "ATIVA",
  testeAte: "",
  diaVencimento: "10",
  alunosPorBlocoNegociado: "",
  precoPorBlocoNegociadoReais: "",
  blocosMinimosNegociado: "",
};

export interface CorpoContratacao {
  planoVersaoId: string;
  status: "TESTE" | "ATIVA";
  diaVencimento: number;
  testeAte?: string;
  alunosPorBlocoNegociado?: number;
  precoPorBlocoCentavosNegociado?: number;
  blocosMinimosPorUnidadeNegociado?: number;
}

// Campo negociado em branco significa "sem negociação" e não vai no corpo —
// o backend recusa `null` explícito nesses campos porque valida
// `z.number().int().positive()`, que também recusa zero.
function inteiroOpcional(valor: string): number | undefined {
  const limpo = valor.trim();
  if (limpo === "") return undefined;
  const numero = Number(limpo);
  return Number.isInteger(numero) ? numero : Number.NaN;
}

// Reais digitados pelo operador viram centavos aqui, na borda. Daqui para
// dentro tudo é inteiro: o valor é reconciliado com gateway de pagamento, onde
// deriva de ponto flutuante não é aceitável.
//
// `Math.round` sobre a multiplicação é necessário: 29.9 * 100 dá
// 2989.9999999999995 em ponto flutuante, e truncar cobraria um centavo a
// menos do que foi combinado.
export function reaisParaCentavos(valor: string): number | undefined {
  const limpo = valor.trim().replace(",", ".");
  if (limpo === "") return undefined;
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return Number.NaN;
  return Math.round(numero * 100);
}

export interface ProblemaContratacao {
  campo: keyof FormularioContratacao;
  mensagem: string;
}

// Espelha as regras do backend para que o operador veja o que está errado no
// campo, em vez de receber "Contratação inválida." sem saber qual dos sete
// campos causou a recusa.
//
// Não substitui a validação do servidor — ele continua sendo a autoridade, e
// há regras que só ele pode conferir (assinante ainda ser PROSPECT, não haver
// assinatura vigente, a versão do plano estar em vigor).
export function validarContratacao(
  formulario: FormularioContratacao,
  agora: Date = new Date()
): ProblemaContratacao[] {
  const problemas: ProblemaContratacao[] = [];

  if (!formulario.planoVersaoId) {
    problemas.push({ campo: "planoVersaoId", mensagem: "Escolha o plano." });
  }

  const dia = Number(formulario.diaVencimento.trim());
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    problemas.push({
      campo: "diaVencimento",
      // O teto é 28 para que a data exista em todo mês, fevereiro incluído.
      mensagem: "Dia de vencimento precisa ser um número inteiro de 1 a 28.",
    });
  }

  if (formulario.status === "TESTE") {
    const ate = formulario.testeAte.trim();
    if (!ate) {
      problemas.push({ campo: "testeAte", mensagem: "Informe até quando vai o período de teste." });
    } else {
      // A data vem do <input type="date"> como AAAA-MM-DD. Interpretada como
      // meia-noite UTC, que é como o backend a recebe.
      const data = new Date(`${ate}T00:00:00.000Z`);
      if (Number.isNaN(data.getTime())) {
        problemas.push({ campo: "testeAte", mensagem: "Data de teste inválida." });
      } else if (data <= agora) {
        problemas.push({ campo: "testeAte", mensagem: "O período de teste precisa terminar no futuro." });
      }
    }
  }

  const negociados: Array<[keyof FormularioContratacao, number | undefined, string]> = [
    ["alunosPorBlocoNegociado", inteiroOpcional(formulario.alunosPorBlocoNegociado), "Alunos por faixa"],
    ["precoPorBlocoNegociadoReais", reaisParaCentavos(formulario.precoPorBlocoNegociadoReais), "Preço por faixa"],
    ["blocosMinimosNegociado", inteiroOpcional(formulario.blocosMinimosNegociado), "Faixas mínimas"],
  ];

  for (const [campo, valor, rotulo] of negociados) {
    if (valor === undefined) continue;
    if (!Number.isInteger(valor) || valor <= 0) {
      // Zero é recusado pelo backend (`z.number().int().positive()`). Dizer
      // isso aqui evita um 400 genérico depois de o operador ter preenchido
      // o formulário inteiro.
      problemas.push({ campo, mensagem: `${rotulo}: informe um valor maior que zero, ou deixe em branco.` });
    }
  }

  return problemas;
}

export function montarCorpo(formulario: FormularioContratacao): CorpoContratacao {
  const corpo: CorpoContratacao = {
    planoVersaoId: formulario.planoVersaoId,
    status: formulario.status,
    diaVencimento: Number(formulario.diaVencimento.trim()),
  };

  if (formulario.status === "TESTE") {
    corpo.testeAte = new Date(`${formulario.testeAte.trim()}T00:00:00.000Z`).toISOString();
  }

  const alunos = inteiroOpcional(formulario.alunosPorBlocoNegociado);
  if (alunos !== undefined) corpo.alunosPorBlocoNegociado = alunos;

  const preco = reaisParaCentavos(formulario.precoPorBlocoNegociadoReais);
  if (preco !== undefined) corpo.precoPorBlocoCentavosNegociado = preco;

  const blocos = inteiroOpcional(formulario.blocosMinimosNegociado);
  if (blocos !== undefined) corpo.blocosMinimosPorUnidadeNegociado = blocos;

  return corpo;
}

// Por que a contratação pode não estar disponível. Devolve `null` quando está.
//
// O backend recusa com 409 e uma mensagem única para quatro causas distintas;
// aqui separamos as duas que a tela já conhece, para não oferecer um botão que
// vai falhar.
export function motivoParaNaoContratar(
  assinante: { status: string; assinatura: unknown | null }
): string | null {
  if (assinante.assinatura !== null) {
    return "Este assinante já tem assinatura vigente.";
  }
  if (assinante.status !== "PROSPECT") {
    return `Só é possível contratar para assinante em prospecção. Este está como ${assinante.status}.`;
  }
  return null;
}
