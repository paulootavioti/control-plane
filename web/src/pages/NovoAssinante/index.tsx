import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input, Select } from "../../components/ui";
import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const inicial={produtoId:"sysbelt",nomeFantasia:"",razaoSocial:"",documento:"",emailCobranca:"",telefone:"",slug:"",contatoNome:"",contatoEmail:"",contatoTelefone:""};
export function NovoAssinante(){const[d,setD]=useState(inicial),[erro,setErro]=useState(""),[enviando,setEnviando]=useState(false);const navigate=useNavigate();
 const campo=(nome:keyof typeof inicial)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setD({...d,[nome]:e.target.value});
 async function enviar(e:FormEvent){e.preventDefault();setEnviando(true);try{const r=await api.post<{id:string}>("/assinantes",{produtoId:d.produtoId,nomeFantasia:d.nomeFantasia,
  razaoSocial:d.razaoSocial||undefined,documento:d.documento,emailCobranca:d.emailCobranca,telefone:d.telefone||undefined,slug:d.slug,
  contatos:[{nome:d.contatoNome,email:d.contatoEmail||undefined,telefone:d.contatoTelefone||undefined,tipo:"PROPRIETARIO",principal:true}]});navigate(`/assinantes/${r.data.id}`)}catch(x){setErro(getApiErrorMessage(x,"Não foi possível cadastrar o assinante."))}finally{setEnviando(false)}}
 return <><h1>Novo assinante</h1><Card><form className="formulario" onSubmit={enviar}><label>Produto<Select value={d.produtoId} onChange={campo("produtoId")}><option value="sysbelt">SysBelt</option><option value="mecanix">Mecanix</option><option value="psyche">Psyché</option></Select></label>
 {(["nomeFantasia","razaoSocial","documento","emailCobranca","telefone","slug","contatoNome","contatoEmail","contatoTelefone"] as const).map(n=><label key={n}>{({nomeFantasia:"Nome fantasia",razaoSocial:"Razão social",documento:"Documento",emailCobranca:"E-mail de cobrança",telefone:"Telefone",slug:"Slug",contatoNome:"Contato principal",contatoEmail:"E-mail do contato",contatoTelefone:"Telefone do contato"})[n]}<Input required={["nomeFantasia","documento","emailCobranca","slug","contatoNome"].includes(n)} value={d[n]} onChange={campo(n)}/></label>)}
 <div className="campo-largo"><Mensagem texto={erro}/><Button type="submit" disabled={enviando}>{enviando?"Cadastrando…":"Cadastrar prospect"}</Button></div></form></Card></>}
