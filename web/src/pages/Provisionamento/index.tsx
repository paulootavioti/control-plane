import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorMessage, PageHeader, Pagination, Skeleton, StatusBadge, Table } from "../../components/ui";
import { api } from "../../services/api";
import { formatarData, rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

interface Ambiente {
  id: string; status: string; provider: string; regiao: string; schemaVersaoAtual: string | null;
  schemaVersaoDesejada: string | null; necessitaAtencao: boolean;
  assinante: { id: string; nomeFantasia: string; slug: string };
  ultimoEvento: { tipo: string; status: string; atualizadoEm: string } | null;
}
interface Pagina { itens: Ambiente[]; paginacao: { pagina: number; total: number; totalPaginas: number } }

export function Provisionamento() {
  const [dados, setDados] = useState<Pagina | null>(null);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(() => {
    setCarregando(true);
    api.get<Pagina>("/provisionamento/ambientes", { params: { pagina, limite: 20 } })
      .then((resposta) => { setDados(resposta.data); setErro(""); })
      .catch((falha) => setErro(getApiErrorMessage(falha, "Não foi possível carregar os ambientes.")))
      .finally(() => setCarregando(false));
  }, [pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  return <>
    <PageHeader kicker="Plataforma · Infraestrutura por conta" title="Provisionamento" />
    <ErrorMessage message={erro} onRetry={carregar} />
    {carregando && <Skeleton rows={7} />}
    {!carregando && dados?.itens.length === 0 && <EmptyState title="Nenhum ambiente provisionado" description="Os ambientes aparecerão aqui depois da contratação e da primeira solicitação de provisionamento." />}
    {!carregando && dados && dados.itens.length > 0 && <>
      <Table label="Ambientes de assinantes"><thead><tr><th>Conta</th><th>Provedor</th><th>Região</th><th>Schema</th><th>Última operação</th><th>Estado</th></tr></thead><tbody>
        {dados.itens.map((ambiente) => <tr key={ambiente.id}>
          <td><span className="subscriber-cell"><strong><Link to={`/assinantes/${ambiente.assinante.id}`}>{ambiente.assinante.nomeFantasia}</Link></strong><small>{ambiente.assinante.slug}</small></span></td>
          <td>{ambiente.provider}</td><td>{ambiente.regiao}</td><td>{ambiente.schemaVersaoAtual ?? "Não aplicado"}{ambiente.schemaVersaoAtual !== ambiente.schemaVersaoDesejada ? " · atualização pendente" : ""}</td>
          <td>{ambiente.ultimoEvento ? `${rotularStatus(ambiente.ultimoEvento.tipo)} · ${formatarData(ambiente.ultimoEvento.atualizadoEm)}` : "Sem eventos"}</td>
          <td><StatusBadge status={ambiente.status}>{rotularStatus(ambiente.status)}</StatusBadge></td>
        </tr>)}
      </tbody></Table>
      <Pagination page={dados.paginacao.pagina} totalPages={dados.paginacao.totalPaginas} total={dados.paginacao.total} onChange={setPagina} />
    </>}
    <p className="boundary-note">Cada linha representa infraestrutura exclusiva de uma conta. Nenhuma ação operacional deve cruzar essa fronteira.</p>
  </>;
}
