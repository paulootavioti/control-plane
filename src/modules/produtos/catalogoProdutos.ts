export const CODIGOS_PRODUTO = ["sysbelt", "mecanix", "psyche"] as const;

export type CodigoProduto = (typeof CODIGOS_PRODUTO)[number];

export type PoliticaAcessoInadimplencia =
  | "SUSPENSAO_INTEGRAL"
  | "SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO";

export interface DefinicaoProduto {
  codigo: CodigoProduto;
  nome: string;
  metricaCobranca: "ALUNOS_ATIVOS" | "PLANO_UNIDADE" | "PROFISSIONAIS_ATIVOS";
  politicaAcessoInadimplencia: PoliticaAcessoInadimplencia;
}

export const PRODUTOS: Record<CodigoProduto, DefinicaoProduto> = {
  sysbelt: {
    codigo: "sysbelt",
    nome: "SysBelt",
    metricaCobranca: "ALUNOS_ATIVOS",
    politicaAcessoInadimplencia: "SUSPENSAO_INTEGRAL",
  },
  mecanix: {
    codigo: "mecanix",
    nome: "Mecanix",
    metricaCobranca: "PLANO_UNIDADE",
    politicaAcessoInadimplencia: "SUSPENSAO_INTEGRAL",
  },
  psyche: {
    codigo: "psyche",
    nome: "Psyché",
    metricaCobranca: "PROFISSIONAIS_ATIVOS",
    politicaAcessoInadimplencia: "SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO",
  },
};

export function obterProduto(codigo: string): DefinicaoProduto {
  const produto = PRODUTOS[codigo as CodigoProduto];
  if (!produto) throw new Error("PRODUTO_NAO_SUPORTADO");
  return produto;
}
