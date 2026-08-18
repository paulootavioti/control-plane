// Valores da plataforma são inteiros em centavos no banco e na API. A
// conversão para reais acontece só aqui, na borda de exibição — nenhuma soma
// é feita em ponto flutuante antes disso.
export function formatarCentavos(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Datas de calendário chegam como ISO e são formatadas em UTC. Sem isso, uma
// data anotada como 01/03 apareceria como 28/02 para quem estiver a oeste de
// Greenwich — o dia mudaria conforme o fuso de quem consulta.
export function formatarData(iso: string | null | undefined) {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const ROTULOS: Record<string, string> = {
  PROSPECT: "Prospect",
  EM_PROVISIONAMENTO: "Em provisionamento",
  ATIVO: "Ativo",
  ATIVA: "Ativa",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
  ERRO_PROVISIONAMENTO: "Erro no provisionamento",
  RASCUNHO: "Rascunho",
  ABERTA: "Aberta",
  PAGA: "Paga",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
  ESTORNADA: "Estornada",
  PENDENTE: "Pendente",
  CRIANDO_PROJETO: "Criando projeto",
  GRAVANDO_SEGREDO: "Gravando segredo",
  APLICANDO_MIGRATIONS: "Aplicando migrations",
  EXECUTANDO_BOOTSTRAP: "Executando bootstrap",
  VALIDANDO: "Validando",
  FALHOU: "Falhou",
  ENCERRADA: "Encerrada",
  TESTE: "Teste",
  SUSPENSA: "Suspensa",
  ENCERRADO: "Encerrado",
};

// Um status desconhecido aparece como veio, em vez de sumir da tela. Se a API
// ganhar um estado novo, o operador enxerga "ALGO_NOVO" e sabe que existe —
// devolver vazio esconderia a informação justamente quando ela é inesperada.
export function rotularStatus(status: string) {
  return ROTULOS[status] ?? status;
}
