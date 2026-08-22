import { useCallback, useEffect, useState } from "react";

import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

interface ResumoFila { recebidos?: number; processando?: number; pendentes?: number; executando?: number; falhos?: number; falhas?: number }
interface Resumo { consultadoEm: string; webhooks: ResumoFila; dunning: ResumoFila; notificacoes: ResumoFila }
interface WebhookFalho { id: string; tipo: string; acao: string; tentativas: number; erroSanitizado: string | null; recebidoEm: string }
interface NotificacaoFalha { id: string; tipo: string; tentativas: number; erroSanitizado: string | null; criadoEm: string }
interface DunningFalho { id: string; diaRegua: number; acao: string; erroSanitizado: string | null; agendadaPara: string; assinatura: { id: string; status: string } }
interface Falhas { webhooks: WebhookFalho[]; dunning: DunningFalho[]; notificacoes: NotificacaoFalha[]; limite: number }
interface ExecucaoWorker { id: string; status: string; limite: number; eventos: number; dunning: number; reconciliacoes: number; notificacoes: number; falhas: number; erroSanitizado: string | null; iniciadoEm: string; concluidoEm: string | null }
interface Prontidao { prontoParaHomologacao: boolean; prontoParaProducao: boolean; mercadoPago: Record<string, boolean>; worker: Record<string, boolean>; notificacoes: Record<string, boolean> }

function dataHora(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR");
}

function CartaoFila({ titulo, dados }: { titulo: string; dados: ResumoFila }) {
  return <section className="cartao"><h2>{titulo}</h2><ul className="contagens">
    {Object.entries(dados).filter(([, valor]) => typeof valor === "number").map(([rotulo, valor]) =>
      <li key={rotulo}><strong>{valor}</strong><span>{rotulo}</span></li>)}
  </ul></section>;
}

export function Billing() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [falhas, setFalhas] = useState<Falhas | null>(null);
  const [execucoes, setExecucoes] = useState<ExecucaoWorker[]>([]);
  const [prontidao, setProntidao] = useState<Prontidao | null>(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [resumoResposta, falhasResposta, execucoesResposta, prontidaoResposta] = await Promise.all([
        api.get<Resumo>("/billing/operacao/resumo"),
        api.get<Falhas>("/billing/operacao/falhas"),
        api.get<ExecucaoWorker[]>("/billing/operacao/execucoes?limite=10"),
        api.get<Prontidao>("/billing/operacao/prontidao"),
      ]);
      setResumo(resumoResposta.data);
      setFalhas(falhasResposta.data);
      setExecucoes(execucoesResposta.data);
      setProntidao(prontidaoResposta.data);
      setErro("");
    } catch (erroDaBusca) {
      setErro(getApiErrorMessage(erroDaBusca, "Não foi possível carregar a operação do billing."));
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function reprocessar(tipo: "webhooks" | "dunning" | "notificacoes", id: string) {
    if (!window.confirm("Confirma a devolução deste item à fila de processamento?")) return;
    setProcessando(id); setErro(""); setSucesso("");
    try {
      await api.post(`/billing/operacao/${tipo}/${id}/reprocessar`);
      setSucesso("Item devolvido à fila. O worker fará o processamento assíncrono.");
      await carregar();
    } catch (erroDaAcao) {
      setErro(getApiErrorMessage(erroDaAcao, "Não foi possível reprocessar o item."));
    } finally { setProcessando(null); }
  }

  if (!resumo || !falhas || !prontidao) return <><h1>Operação do billing</h1><Mensagem texto={erro || "Carregando…"} tipo={erro ? "erro" : "vazio"} /></>;

  return <>
    <div className="linha-titulo"><div><h1>Operação do billing</h1><small className="total">Atualizado em {dataHora(resumo.consultadoEm)}</small></div><button className="botao-texto" onClick={() => void carregar()}>Atualizar</button></div>
    <Mensagem texto={erro} /><Mensagem texto={sucesso} tipo="vazio" />
    <div className="grade"><CartaoFila titulo="Webhooks" dados={resumo.webhooks} /><CartaoFila titulo="Dunning" dados={resumo.dunning} /><CartaoFila titulo="Notificações" dados={resumo.notificacoes} /></div>
    <div className="grade-larga secao-operacional">
      <section className="cartao cartao-largo"><h2>Prontidão</h2><p><span className={prontidao.prontoParaHomologacao ? "estado-ok" : "estado-pendente"}>{prontidao.prontoParaHomologacao ? "Pronto para homologação" : "Homologação bloqueada"}</span> · <span className={prontidao.prontoParaProducao ? "estado-ok" : "estado-pendente"}>{prontidao.prontoParaProducao ? "Produção habilitada" : "Produção ainda desabilitada"}</span></p><div className="grade-checklist">{[["Mercado Pago", prontidao.mercadoPago], ["Worker", prontidao.worker], ["Notificações", prontidao.notificacoes]].map(([titulo, itens]) => <div key={titulo as string}><strong>{titulo as string}</strong><ul className="checklist">{Object.entries(itens as Record<string, boolean>).map(([nome, ok]) => <li key={nome} className={ok ? "estado-ok" : "estado-pendente"}>{ok ? "✓" : "○"} {nome}</li>)}</ul></div>)}</div></section>
      <section className="cartao cartao-largo"><h2>Últimas execuções do worker</h2>{execucoes.length === 0 ? <p className="vazio">Nenhuma execução registrada.</p> : <div className="tabela-rolavel"><table><thead><tr><th>Início</th><th>Status</th><th>Eventos</th><th>Dunning</th><th>Reconciliações</th><th>Notificações</th><th>Falhas</th></tr></thead><tbody>{execucoes.map(item => <tr key={item.id}><td>{dataHora(item.iniciadoEm)}</td><td>{item.status}</td><td>{item.eventos}</td><td>{item.dunning}</td><td>{item.reconciliacoes}</td><td>{item.notificacoes}</td><td>{item.falhas}</td></tr>)}</tbody></table></div>}</section>
      <section className="cartao"><h2>Webhooks falhos</h2>{falhas.webhooks.length === 0 ? <p className="vazio">Nenhum webhook falho.</p> : <ul className="eventos">{falhas.webhooks.map(item => <li className="evento-falhou" key={item.id}><div className="evento-linha"><strong>{item.tipo}</strong><span>{item.acao}</span></div><small>{dataHora(item.recebidoEm)} · {item.tentativas} tentativas</small>{item.erroSanitizado && <p className="evento-erro">{item.erroSanitizado}</p>}<button className="botao-acao" disabled={processando === item.id} onClick={() => void reprocessar("webhooks", item.id)}>Reprocessar</button></li>)}</ul>}</section>
      <section className="cartao"><h2>Notificações falhas</h2>{falhas.notificacoes.length === 0 ? <p className="vazio">Nenhuma notificação falha.</p> : <ul className="eventos">{falhas.notificacoes.map(item => <li className="evento-falhou" key={item.id}><strong>{item.tipo}</strong><small>{dataHora(item.criadoEm)} · {item.tentativas} tentativas</small>{item.erroSanitizado && <p className="evento-erro">{item.erroSanitizado}</p>}<button className="botao-acao" disabled={processando === item.id} onClick={() => void reprocessar("notificacoes", item.id)}>Reprocessar</button></li>)}</ul>}</section>
      <section className="cartao"><h2>Dunning falho</h2>{falhas.dunning.length === 0 ? <p className="vazio">Nenhum passo de dunning falho.</p> : <ul className="eventos">{falhas.dunning.map(item => <li className="evento-falhou" key={item.id}><div className="evento-linha"><strong>Dia {item.diaRegua}</strong><span>{item.acao}</span></div><small>{dataHora(item.agendadaPara)} · assinatura {item.assinatura.status}</small>{item.erroSanitizado && <p className="evento-erro">{item.erroSanitizado}</p>}<button className="botao-acao" disabled={processando === item.id} onClick={() => void reprocessar("dunning", item.id)}>Reprocessar</button></li>)}</ul>}</section>
    </div>
  </>;
}
