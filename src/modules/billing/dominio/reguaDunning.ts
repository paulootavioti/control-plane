export interface PassoDunning {
  dia: 0 | 1 | 3 | 7 | 10;
  acao: "NOTIFICAR" | "RETENTAR_E_NOTIFICAR" | "SUSPENDER_ADMINISTRATIVO";
}

export const REGUA_DUNNING_PADRAO: readonly PassoDunning[] = [
  { dia: 0, acao: "NOTIFICAR" },
  { dia: 1, acao: "RETENTAR_E_NOTIFICAR" },
  { dia: 3, acao: "RETENTAR_E_NOTIFICAR" },
  { dia: 7, acao: "RETENTAR_E_NOTIFICAR" },
  { dia: 10, acao: "SUSPENDER_ADMINISTRATIVO" },
];

export function passosPendentes(diasDesdeFalha: number, diasExecutados: readonly number[]): PassoDunning[] {
  const executados = new Set(diasExecutados);
  return REGUA_DUNNING_PADRAO.filter((passo) => passo.dia <= diasDesdeFalha && !executados.has(passo.dia));
}
