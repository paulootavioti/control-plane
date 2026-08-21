import type { CodigoProduto } from "../../produtos/catalogoProdutos";
import { obterProduto } from "../../produtos/catalogoProdutos";

export const ESTADOS_ASSINATURA = [
  "TRIAL", "ATIVA", "INADIMPLENTE", "SUSPENSA", "CANCELADA",
] as const;

export type EstadoAssinatura = (typeof ESTADOS_ASSINATURA)[number];

const TRANSICOES: Record<EstadoAssinatura, readonly EstadoAssinatura[]> = {
  TRIAL: ["ATIVA", "INADIMPLENTE", "CANCELADA"],
  ATIVA: ["INADIMPLENTE", "CANCELADA"],
  INADIMPLENTE: ["ATIVA", "SUSPENSA", "CANCELADA"],
  SUSPENSA: ["ATIVA", "CANCELADA"],
  CANCELADA: [],
};

export function validarTransicao(origem: EstadoAssinatura, destino: EstadoAssinatura): void {
  if (!TRANSICOES[origem].includes(destino)) throw new Error("TRANSICAO_ASSINATURA_INVALIDA");
}

export interface EfeitoAcesso {
  acessoAdministrativo: "LIBERADO" | "RESTRITO_REGULARIZACAO";
  acessoClinico: "LIBERADO" | "NAO_APLICAVEL";
  excluirDados: false;
}

export function calcularEfeitoAcesso(produtoCodigo: CodigoProduto, estado: EstadoAssinatura): EfeitoAcesso {
  const produto = obterProduto(produtoCodigo);
  const restrito = estado === "SUSPENSA" || estado === "CANCELADA";
  return {
    acessoAdministrativo: restrito ? "RESTRITO_REGULARIZACAO" : "LIBERADO",
    acessoClinico: produto.politicaAcessoInadimplencia === "SUSPENSAO_ADMINISTRATIVA_MANTER_CLINICO"
      ? "LIBERADO"
      : "NAO_APLICAVEL",
    excluirDados: false,
  };
}
