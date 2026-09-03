import { useEffect, useState } from "react";

import { ErrorMessage, PageHeader, Skeleton, StatBand } from "../../components/ui";
import { api } from "../../services/api";
import { formatarCentavos } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

interface ResumoFatura {
  quantidade: number;
  totalCentavos: number;
}

interface Resumo {
  assinantes: Record<string, number>;
  ambientes: Record<string, number>;
  licencas: Record<string, number>;
  faturas: Record<string, ResumoFatura>;
}

export function Dashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Resumo>("/dashboard/resumo")
      .then((resposta) => setResumo(resposta.data))
      .catch((erroDaBusca) =>
        setErro(getApiErrorMessage(erroDaBusca, "Não foi possível carregar a visão geral."))
      )
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <><PageHeader kicker="Plataforma · Agora" title="Visão geral" /><Skeleton rows={6} /></>;
  if (erro) return <ErrorMessage message={erro} onRetry={() => window.location.reload()} />;
  if (!resumo) return null;

  const assinantesAtivos = (resumo.assinantes.ATIVO ?? 0) + (resumo.assinantes.ATIVA ?? 0);
  const falhas = resumo.ambientes.FALHOU ?? resumo.ambientes.ERRO ?? 0;
  const faturasPagas = resumo.faturas.PAGA?.totalCentavos ?? 0;
  const atrasadas = resumo.faturas.VENCIDA?.quantidade ?? 0;

  return (
    <>
      <PageHeader kicker="Plataforma · Agora" title="Visão geral" />
      <StatBand stats={[{ label: "Falhas de provisionamento", value: falhas, context: falhas ? "Exigem ação da operação" : "Nenhuma falha aberta", critical: falhas > 0 }, { label: "MRR recebido", value: formatarCentavos(faturasPagas), context: "Faturas pagas no período consultado" }, { label: "Assinantes ativos", value: assinantesAtivos, context: "Contas com acesso à plataforma" }]} />
      <StatBand secondary stats={[{ label: "Assinantes suspensos", value: resumo.assinantes.SUSPENSO ?? 0 }, { label: "Faturas em atraso", value: atrasadas }, { label: "Ambientes ativos", value: resumo.ambientes.ATIVO ?? 0 }, { label: "Licenças ativas", value: resumo.licencas.ATIVA ?? 0 }]} />
      <p className="boundary-note">Cada assinante representa uma conta e uma fronteira independente de dados. Confirme a conta antes de executar ações operacionais.</p>
    </>
  );
}
