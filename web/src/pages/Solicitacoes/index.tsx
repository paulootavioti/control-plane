import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Input, Select, StatusBadge } from "../../components/ui";
import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { formatarData, rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import { useAuth } from "../../contexts/useAuth";

type Item = { id:string; produtoId:string; intencao:string; nomeOrganizacao:string; documento:string;
  responsavel:string; email:string; telefone:string|null; status:string; motivo:string|null; criadoEm:string };

export function Solicitacoes() {
  const { podeVer } = useAuth();
  const [itens,setItens]=useState<Item[]>([]), [status,setStatus]=useState("RECEBIDA"), [produto,setProduto]=useState("");
  const [erro,setErro]=useState(""), [motivos,setMotivos]=useState<Record<string,string>>({}); const navigate=useNavigate();
  const carregar=useCallback(()=>api.get<{itens:Item[]}>("/solicitacoes",{params:{status:status||undefined,produtoId:produto||undefined}})
    .then(r=>{setItens(r.data.itens);setErro("")}).catch(e=>setErro(getApiErrorMessage(e,"Não foi possível carregar as solicitações."))),[status,produto]);
  useEffect(()=>{void carregar()},[carregar]);
  async function agir(item:Item,acao:"aprovar"|"recusar"|"converter") { try {
    const r=await api.post<{assinanteId?:string}>(`/solicitacoes/${item.id}/${acao}`,acao==="recusar"?{motivo:motivos[item.id]}:{});
    if(acao==="converter"&&r.data.assinanteId) navigate(`/assinantes/${r.data.assinanteId}`); else {
      setStatus(acao === "recusar" ? "RECUSADA" : "APROVADA");
      await carregar();
    }
  } catch(e){setErro(getApiErrorMessage(e,"A ação não pôde ser concluída."))} }
  return <><h1>Solicitações</h1><div className="filtros"><Select value={produto} onChange={e=>setProduto(e.target.value)} aria-label="Produto">
    <option value="">Todos os produtos</option><option value="sysbelt">SysBelt</option><option value="mecanix">Mecanix</option><option value="psyche">Psyché</option></Select>
    <Select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Status"><option value="">Todos os status</option><option value="RECEBIDA">Recebidas</option><option value="APROVADA">Aprovadas</option><option value="RECUSADA">Recusadas</option><option value="CONVERTIDA">Convertidas</option></Select></div>
    <Mensagem texto={erro}/><div className="lista">{itens.map(i=><Card key={i.id}><div className="linha-titulo"><strong>{i.nomeOrganizacao}</strong><StatusBadge status={i.status}>{rotularStatus(i.status)}</StatusBadge></div>
      <p>{i.produtoId} · {rotularStatus(i.intencao)} · {formatarData(i.criadoEm)}</p><p>{i.responsavel} · {i.email}{i.telefone?` · ${i.telefone}`:""}</p>
      {i.status==="RECUSADA"&&<p className="motivo-recusa"><strong>Motivo da recusa:</strong> {i.motivo}</p>}
      {i.status==="RECEBIDA"&&<div className="acoes"><Button onClick={()=>agir(i,"aprovar")}>Aprovar</Button><Input placeholder="Motivo obrigatório" value={motivos[i.id]||""} onChange={e=>setMotivos(m=>({...m,[i.id]:e.target.value}))}/><Button disabled={(motivos[i.id]||"").trim().length<3} onClick={()=>agir(i,"recusar")}>Recusar</Button></div>}
      {i.status==="APROVADA"&&<Button onClick={()=>agir(i,"converter")}>Converter em assinante</Button>}
      {podeVer(["ADMIN_PLATAFORMA"])&&<p><Link to={`/auditoria?alvoId=${i.id}`}>Ver histórico desta solicitação</Link></p>}</Card>)}</div></>;
}
