import { useEffect, useState, type FormEvent } from "react";

import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { formatarCentavos } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import {
  CONTRATACAO_VAZIA,
  montarCorpo,
  validarContratacao,
  type FormularioContratacao as Dados,
  type ProblemaContratacao,
} from "../../utils/contratacao";

interface PlanoVersao {
  id: string;
  versao: number;
  alunosPorBloco: number;
  precoPorBlocoCentavos: number;
  blocosMinimosPorUnidade: number;
  moeda: string;
}

interface Plano {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versoes: PlanoVersao[];
}

interface Props {
  assinanteId: string;
  aoContratar: () => void;
}

export function FormularioContratacao({ assinanteId, aoContratar }: Props) {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [dados, setDados] = useState<Dados>(CONTRATACAO_VAZIA);
  const [problemas, setProblemas] = useState<ProblemaContratacao[]>([]);
  const [erro, setErro] = useState("");
  const [carregandoPlanos, setCarregandoPlanos] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .get<{ itens: Plano[] }>("/planos")
      .then((resposta) => setPlanos(resposta.data.itens))
      .catch((erroDaBusca) =>
        setErro(getApiErrorMessage(erroDaBusca, "Não foi possível carregar os planos."))
      )
      .finally(() => setCarregandoPlanos(false));
  }, []);

  // A listagem já vem filtrada às versões em vigor. Um plano sem versão vigente
  // não pode ser contratado, então nem aparece na escolha.
  const opcoes = planos.flatMap((plano) =>
    plano.versoes.map((versao) => ({
      id: versao.id,
      rotulo: `${plano.nome} — v${versao.versao} · ${formatarCentavos(versao.precoPorBlocoCentavos)} a cada ${versao.alunosPorBloco} alunos`,
    }))
  );

  const problemaDe = (campo: keyof Dados) =>
    problemas.find((problema) => problema.campo === campo)?.mensagem;

  const alterar = (campo: keyof Dados) => (valor: string) => {
    setDados((atual) => ({ ...atual, [campo]: valor }));
    // Some o aviso do campo assim que ele é tocado: manter o erro anterior na
    // tela enquanto a pessoa digita a correção é ruído.
    setProblemas((atual) => atual.filter((problema) => problema.campo !== campo));
  };

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();

    const encontrados = validarContratacao(dados);
    setProblemas(encontrados);
    if (encontrados.length > 0) return;

    try {
      setEnviando(true);
      setErro("");
      await api.post(`/assinantes/${assinanteId}/assinaturas`, montarCorpo(dados));
      aoContratar();
    } catch (erroDaContratacao) {
      setErro(
        getApiErrorMessage(
          erroDaContratacao,
          "Não foi possível contratar. Confira se o assinante ainda está em prospecção e se o plano continua em vigor."
        )
      );
    } finally {
      setEnviando(false);
    }
  }

  if (carregandoPlanos) {
    return (
      <section className="cartao">
        <h2>Contratar assinatura</h2>
        <p className="carregando">Carregando planos…</p>
      </section>
    );
  }

  if (opcoes.length === 0) {
    return (
      <section className="cartao">
        <h2>Contratar assinatura</h2>
        <Mensagem
          tipo="vazio"
          texto="Nenhum plano com versão em vigor. Cadastre um plano antes de contratar."
        />
      </section>
    );
  }

  return (
    <section className="cartao cartao-largo">
      <h2>Contratar assinatura</h2>

      <form className="formulario" onSubmit={aoEnviar}>
        <label className="campo-largo">
          Plano
          <select
            value={dados.planoVersaoId}
            onChange={(evento) => alterar("planoVersaoId")(evento.target.value)}
          >
            <option value="">Escolha…</option>
            {opcoes.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
          {problemaDe("planoVersaoId") && <small className="erro-campo">{problemaDe("planoVersaoId")}</small>}
        </label>

        <label>
          Situação inicial
          <select
            value={dados.status}
            onChange={(evento) => alterar("status")(evento.target.value)}
          >
            <option value="ATIVA">Ativa</option>
            <option value="TESTE">Período de teste</option>
          </select>
        </label>

        <label>
          Teste até
          <input
            type="date"
            value={dados.testeAte}
            onChange={(evento) => alterar("testeAte")(evento.target.value)}
            disabled={dados.status !== "TESTE"}
          />
          {problemaDe("testeAte") && <small className="erro-campo">{problemaDe("testeAte")}</small>}
        </label>

        <label>
          Dia de vencimento
          <input
            type="number"
            min={1}
            max={28}
            value={dados.diaVencimento}
            onChange={(evento) => alterar("diaVencimento")(evento.target.value)}
          />
          {problemaDe("diaVencimento") && (
            <small className="erro-campo">{problemaDe("diaVencimento")}</small>
          )}
        </label>

        <p className="secao-formulario">
          Condição negociada — deixe em branco para usar o preço de tabela do plano.
        </p>

        <label>
          Alunos por faixa
          <input
            type="number"
            min={1}
            value={dados.alunosPorBlocoNegociado}
            onChange={(evento) => alterar("alunosPorBlocoNegociado")(evento.target.value)}
          />
          {problemaDe("alunosPorBlocoNegociado") && (
            <small className="erro-campo">{problemaDe("alunosPorBlocoNegociado")}</small>
          )}
        </label>

        <label>
          Preço por faixa (R$)
          <input
            type="text"
            inputMode="decimal"
            placeholder="29,00"
            value={dados.precoPorBlocoNegociadoReais}
            onChange={(evento) => alterar("precoPorBlocoNegociadoReais")(evento.target.value)}
          />
          {problemaDe("precoPorBlocoNegociadoReais") && (
            <small className="erro-campo">{problemaDe("precoPorBlocoNegociadoReais")}</small>
          )}
        </label>

        <label>
          Faixas mínimas por unidade
          <input
            type="number"
            min={1}
            value={dados.blocosMinimosNegociado}
            onChange={(evento) => alterar("blocosMinimosNegociado")(evento.target.value)}
          />
          {problemaDe("blocosMinimosNegociado") && (
            <small className="erro-campo">{problemaDe("blocosMinimosNegociado")}</small>
          )}
        </label>

        <div className="campo-largo">
          <Mensagem texto={erro} />
          <button type="submit" disabled={enviando}>
            {enviando ? "Contratando…" : "Contratar"}
          </button>
        </div>
      </form>
    </section>
  );
}
