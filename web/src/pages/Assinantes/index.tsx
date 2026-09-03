import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button, EmptyState, ErrorMessage, Input, PageHeader, Pagination, Skeleton, StatusBadge, Table } from "../../components/ui";
import { api } from "../../services/api";
import { rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

interface Assinante {
  id: string;
  nomeFantasia: string;
  documento: string;
  emailCobranca: string;
  slug: string;
  status: string;
  criadoEm: string;
  ambiente: { id: string; status: string; schemaVersaoAtual: string | null } | null;
  // O serviço achata a lista de assinaturas vigentes numa só (`assinaturas[0]`)
  // e o `_count` num número. Estes nomes vêm da RESPOSTA da API, não do
  // `select` do Prisma — os dois diferem, e tipar pelo select é o que fazia
  // esta tela quebrar.
  assinatura: {
    id: string;
    status: string;
    planoVersao: { versao: number; plano: { id: string; nome: string } };
  } | null;
  totalLicencas: number;
}

interface Paginacao {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

interface Pagina {
  itens: Assinante[];
  paginacao: Paginacao;
}

export function Assinantes() {
  const [busca, setBusca] = useState("");
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // A busca é aplicada com atraso para não disparar uma chamada por tecla.
    // O cancelamento evita que uma resposta antiga chegue depois de uma nova e
    // sobrescreva a lista com o resultado de um termo que já não está no campo.
    const controlador = new AbortController();
    const tempo = setTimeout(() => {
      setCarregando(true);
      api
        .get<Pagina>("/assinantes", {
          params: { ...(busca.trim() ? { busca: busca.trim() } : {}), pagina: numeroPagina, limite: 20 },
          signal: controlador.signal,
        })
        .then((resposta) => {
          setPagina(resposta.data);
          setErro("");
        })
        .catch((erroDaBusca) => {
          if (controlador.signal.aborted) return;
          setErro(getApiErrorMessage(erroDaBusca, "Não foi possível carregar os assinantes."));
        })
        .finally(() => {
          if (!controlador.signal.aborted) setCarregando(false);
        });
    }, 300);

    return () => {
      clearTimeout(tempo);
      controlador.abort();
    };
  }, [busca, numeroPagina]);

  return (
    <>
      <PageHeader kicker="Plataforma · Fronteiras de dados" title="Assinantes" />
      <div className="search-band">
      <Input
        type="search"
        aria-label="Buscar assinantes"
        placeholder="Buscar por nome, tenantKey, documento ou e-mail do responsável"
        value={busca}
        onChange={(evento) => { setBusca(evento.target.value); setNumeroPagina(1); }}
      />
      {busca && <Button variant="ghost" onClick={() => { setBusca(""); setNumeroPagina(1); }}>Limpar busca</Button>}
      </div>
      <ErrorMessage message={erro} />
      {carregando && <Skeleton rows={6} />}

      {!carregando && pagina && pagina.itens.length === 0 && (
        <EmptyState title={busca.trim() ? "Nenhum assinante corresponde à busca" : "Nenhum assinante cadastrado"} description={busca.trim() ? "Revise o termo ou limpe a busca para consultar todas as contas." : "Cadastre a primeira academia para iniciar o provisionamento."} action={busca.trim() ? <Button variant="secondary" onClick={() => setBusca("")}>Limpar busca</Button> : undefined} />
      )}

      {!carregando && pagina && pagina.itens.length > 0 && (
        <>
          <Table label="Assinantes da plataforma"><thead><tr><th>Assinante</th><th>Plano</th><th>Unidades</th><th>Ambiente</th><th>Estado</th><th>Ação</th></tr></thead><tbody>
            {pagina.itens.map((assinante) => {
              const { assinatura } = assinante;
              return (
                <tr key={assinante.id} tabIndex={0} onDoubleClick={() => navigate(`/assinantes/${assinante.id}`)} onKeyDown={(event) => { if (event.key === "Enter") navigate(`/assinantes/${assinante.id}`); }}>
                  <td><span className="subscriber-cell"><strong>{assinante.nomeFantasia}</strong><small>{assinante.slug} · {assinante.emailCobranca}</small></span></td>
                  <td>{assinatura ? `${assinatura.planoVersao.plano.nome} · v${assinatura.planoVersao.versao}` : "Sem plano"}</td>
                  <td>{assinante.totalLicencas}</td><td>{assinante.ambiente ? rotularStatus(assinante.ambiente.status) : "Não provisionado"}</td>
                  <td><StatusBadge status={assinante.status}>{rotularStatus(assinante.status)}</StatusBadge></td>
                  <td><span className="row-actions"><Link to={`/assinantes/${assinante.id}`}>Abrir</Link><Button variant="icon" aria-label={`Mais ações para ${assinante.nomeFantasia}`}>⋯</Button></span></td>
                </tr>
              );
            })}
          </tbody></Table>
          <Pagination page={pagina.paginacao.pagina} totalPages={pagina.paginacao.totalPaginas} total={pagina.paginacao.total} onChange={setNumeroPagina} />
        </>
      )}
    </>
  );
}
