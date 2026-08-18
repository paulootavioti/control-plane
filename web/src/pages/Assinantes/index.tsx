import { useEffect, useState } from "react";

import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { formatarData, rotularStatus } from "../../utils/formatar";
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
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // A busca é aplicada com atraso para não disparar uma chamada por tecla.
    // O cancelamento evita que uma resposta antiga chegue depois de uma nova e
    // sobrescreva a lista com o resultado de um termo que já não está no campo.
    const controlador = new AbortController();
    const tempo = setTimeout(() => {
      setCarregando(true);
      api
        .get<Pagina>("/assinantes", {
          params: busca.trim() ? { busca: busca.trim() } : undefined,
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
  }, [busca]);

  return (
    <>
      <h1>Assinantes</h1>

      <input
        className="busca"
        type="search"
        placeholder="Buscar por nome, documento, e-mail ou slug"
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
      />

      <Mensagem texto={erro} />

      {carregando && <p className="carregando">Carregando…</p>}

      {!carregando && pagina && pagina.itens.length === 0 && (
        <Mensagem
          tipo="vazio"
          texto={
            busca.trim()
              ? "Nenhum assinante encontrado para essa busca."
              : "Nenhum assinante cadastrado ainda."
          }
        />
      )}

      {!carregando && pagina && pagina.itens.length > 0 && (
        <>
          <p className="total">
            {pagina.paginacao.total}{" "}
            {pagina.paginacao.total === 1 ? "assinante" : "assinantes"}
          </p>

          <ul className="lista">
            {pagina.itens.map((assinante) => {
              const { assinatura } = assinante;

              return (
                <li key={assinante.id} className="cartao">
                  <div className="linha-titulo">
                    <strong>{assinante.nomeFantasia}</strong>
                    <span className={`etiqueta etiqueta-${assinante.status.toLowerCase()}`}>
                      {rotularStatus(assinante.status)}
                    </span>
                  </div>

                  <dl className="atributos">
                    <div>
                      <dt>Slug</dt>
                      <dd>{assinante.slug}</dd>
                    </div>
                    <div>
                      <dt>Documento</dt>
                      <dd>{assinante.documento}</dd>
                    </div>
                    <div>
                      <dt>Cobrança</dt>
                      <dd>{assinante.emailCobranca}</dd>
                    </div>
                    <div>
                      <dt>Plano</dt>
                      <dd>
                        {assinatura
                          ? `${assinatura.planoVersao.plano.nome} (v${assinatura.planoVersao.versao}) — ${rotularStatus(assinatura.status)}`
                          : "Sem assinatura vigente"}
                      </dd>
                    </div>
                    <div>
                      <dt>Ambiente</dt>
                      <dd>
                        {assinante.ambiente
                          ? rotularStatus(assinante.ambiente.status)
                          : "Não provisionado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Unidades licenciadas</dt>
                      <dd>{assinante.totalLicencas}</dd>
                    </div>
                    <div>
                      <dt>Cadastrado em</dt>
                      <dd>{formatarData(assinante.criadoEm)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
