import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorMessage, Input, PageHeader, Pagination, Select, Skeleton, StatusBadge, Table } from "../../components/ui";
import { api } from "../../services/api";
import { formatarData, rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

interface Registro {
  id: string; origem: string; acao: string; alvoTipo: string; alvoId: string; criadoEm: string;
  operador: { id: string; nome: string; perfil: string };
  assinante: { id: string; nomeFantasia: string; slug: string } | null;
}
interface Pagina { itens: Registro[]; paginacao: { pagina:number; limite:number; total:number; totalPaginas:number } }

export function Auditoria() {
  const [parametros, setParametros] = useSearchParams();
  const [pagina, setPagina] = useState<Pagina | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(true);
  const alvoId = parametros.get("alvoId") ?? "", acao = parametros.get("acao") ?? "", numeroPagina = Number(parametros.get("pagina") ?? "1");
  const carregar = useCallback(() => { setCarregando(true); api.get<Pagina>("/auditoria", { params: {
    alvoId: alvoId || undefined, acao: acao || undefined, pagina: numeroPagina, limite: 20,
  } }).then((resposta) => { setPagina(resposta.data); setErro(""); })
    .catch((e) => setErro(getApiErrorMessage(e, "Não foi possível carregar a auditoria."))).finally(() => setCarregando(false)); }, [alvoId, acao, numeroPagina]);
  useEffect(() => { void carregar(); }, [carregar]);
  const alterar = (nome:string, valor:string) => { const proximos = new URLSearchParams(parametros); if (valor) proximos.set(nome, valor); else proximos.delete(nome); proximos.delete("pagina"); setParametros(proximos); };
  return <><PageHeader kicker="Plataforma · Rastreabilidade" title="Auditoria"/><div className="filtros">
    <Input aria-label="ID do alvo" placeholder="ID da solicitação, assinatura ou ambiente" value={alvoId} onChange={(e)=>alterar("alvoId",e.target.value)}/>
    <Select aria-label="Ação" value={acao} onChange={(e)=>alterar("acao",e.target.value)}><option value="">Todas as ações</option><option value="SOLICITACAO_APROVADA">Solicitação aprovada</option><option value="SOLICITACAO_RECUSADA">Solicitação recusada</option><option value="SOLICITACAO_CONVERTIDA">Solicitação convertida</option><option value="ASSINATURA_CONTRATADA">Assinatura contratada</option><option value="PROVISIONAMENTO_SOLICITADO">Provisionamento solicitado</option></Select>
  </div><ErrorMessage message={erro}/>{carregando&&<Skeleton rows={6}/>} {!carregando&&pagina?.itens.length===0&&<EmptyState title="Nenhum registro encontrado" description="Revise os filtros informados."/>}
  {!carregando&&pagina&&pagina.itens.length>0&&<><Table label="Registros de auditoria"><thead><tr><th>Data</th><th>Ação</th><th>Origem</th><th>Operador</th><th>Alvo</th><th>Assinante</th></tr></thead><tbody>{pagina.itens.map((item)=><tr key={item.id}><td>{formatarData(item.criadoEm)}</td><td>{rotularStatus(item.acao)}</td><td><StatusBadge status={item.origem}>{rotularStatus(item.origem)}</StatusBadge></td><td>{item.operador.nome}</td><td><span className="subscriber-cell"><strong>{item.alvoTipo}</strong><small>{item.alvoId}</small></span></td><td>{item.assinante?<Link to={`/assinantes/${item.assinante.id}`}>{item.assinante.nomeFantasia}</Link>:"—"}</td></tr>)}</tbody></Table><Pagination page={pagina.paginacao.pagina} totalPages={pagina.paginacao.totalPaginas} total={pagina.paginacao.total} onChange={(p)=>alterar("pagina",String(p))}/></>}
  </>;
}
