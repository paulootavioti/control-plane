import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { formatarCentavos, formatarData, rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import { valoresVigentes, type Assinatura } from "../../utils/valoresDaAssinatura";

interface Contato {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo: string;
  principal: boolean;
}

interface Licenca {
  id: string;
  tenantUnidadeId: string;
  nomeExibicao: string | null;
  status: string;
  inicioCobrancaEm: string | null;
  encerramentoCobrancaEm: string | null;
  ultimaSincronizacaoEm: string | null;
}

interface EventoProvisionamento {
  id: string;
  tipo: string;
  status: string;
  etapaAtual: string | null;
  tentativas: number;
  erroSanitizado: string | null;
  criadoEm: string;
  concluidoEm: string | null;
  proximaTentativaEm: string | null;
  retomadaManualDisponivel: boolean;
}

interface Ambiente {
  id: string;
  tenantKey: string;
  status: string;
  provider: string;
  regiao: string;
  postgresVersion: string | null;
  schemaVersaoAtual: string | null;
  schemaVersaoDesejada: string | null;
  ultimaMigrationEm: string | null;
  ultimoHealthCheckEm: string | null;
  ultimoBackupVerificadoEm: string | null;
  ultimaRotacaoEm: string | null;
  revisaoConcessao: number | null;
  ultimaConcessaoEmitidaEm: string | null;
  eventos: EventoProvisionamento[];
}

interface Fatura {
  id: string;
  competencia: string;
  vencimentoEm: string;
  status: string;
  subtotalCentavos: number;
  descontoCentavos: number;
  acrescimoCentavos: number;
  totalCentavos: number;
  gateway: string | null;
  emitidaEm: string | null;
  pagaEm: string | null;
  totalItens: number;
}

interface DetalheAssinante {
  id: string;
  nomeFantasia: string;
  razaoSocial: string | null;
  documento: string;
  emailCobranca: string;
  telefone: string | null;
  slug: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
  contatos: Contato[];
  licencas: Licenca[];
  ambiente: Ambiente | null;
  assinatura: Assinatura | null;
  faturas: Fatura[];
}

function Atributo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function BlocoAssinatura({ assinatura }: { assinatura: Assinatura }) {
  const valores = valoresVigentes(assinatura);
  const { planoVersao } = assinatura;

  // O valor negociado é marcado na tela junto com o de tabela. Mostrar só o
  // vigente esconderia que houve acordo; mostrar só o de tabela mostraria um
  // preço que ninguém está pagando.
  const marca = (vigente: { valor: number; negociado: boolean }, doPlano: number, formatar: (n: number) => string) =>
    vigente.negociado ? (
      <>
        {formatar(vigente.valor)}{" "}
        <span className="negociado" title={`Tabela: ${formatar(doPlano)}`}>
          negociado
        </span>
      </>
    ) : (
      formatar(vigente.valor)
    );

  return (
    <section className="cartao">
      <h2>Assinatura vigente</h2>

      <dl className="atributos">
        <Atributo rotulo="Plano">
          {planoVersao.plano.nome} (v{planoVersao.versao})
        </Atributo>
        <Atributo rotulo="Situação">{rotularStatus(assinatura.status)}</Atributo>
        <Atributo rotulo="Início">{formatarData(assinatura.inicioEm)}</Atributo>
        <Atributo rotulo="Teste até">{formatarData(assinatura.testeAte)}</Atributo>
        <Atributo rotulo="Dia de vencimento">{assinatura.diaVencimento}</Atributo>
        <Atributo rotulo="Alunos por faixa">
          {marca(valores.alunosPorBloco, planoVersao.alunosPorBloco, String)}
        </Atributo>
        <Atributo rotulo="Preço por faixa">
          {marca(valores.precoPorBlocoCentavos, planoVersao.precoPorBlocoCentavos, formatarCentavos)}
        </Atributo>
        <Atributo rotulo="Faixas mínimas por unidade">
          {marca(valores.blocosMinimosPorUnidade, planoVersao.blocosMinimosPorUnidade, String)}
        </Atributo>
      </dl>
    </section>
  );
}

function BlocoAmbiente({ ambiente }: { ambiente: Ambiente }) {
  const desatualizado =
    ambiente.schemaVersaoDesejada !== null &&
    ambiente.schemaVersaoAtual !== ambiente.schemaVersaoDesejada;

  return (
    <section className="cartao">
      <h2>Ambiente</h2>

      <dl className="atributos">
        <Atributo rotulo="Situação">{rotularStatus(ambiente.status)}</Atributo>
        <Atributo rotulo="Provedor">{ambiente.provider}</Atributo>
        <Atributo rotulo="Região">{ambiente.regiao}</Atributo>
        <Atributo rotulo="PostgreSQL">{ambiente.postgresVersion ?? "—"}</Atributo>
        <Atributo rotulo="Schema aplicado">
          {ambiente.schemaVersaoAtual ?? "—"}
          {desatualizado && (
            <span className="alerta" title={`Desejada: ${ambiente.schemaVersaoDesejada}`}>
              atrás da desejada
            </span>
          )}
        </Atributo>
        <Atributo rotulo="Última migration">{formatarData(ambiente.ultimaMigrationEm)}</Atributo>
        <Atributo rotulo="Último health check">{formatarData(ambiente.ultimoHealthCheckEm)}</Atributo>
        <Atributo rotulo="Backup verificado">{formatarData(ambiente.ultimoBackupVerificadoEm)}</Atributo>
        <Atributo rotulo="Última rotação de segredo">{formatarData(ambiente.ultimaRotacaoEm)}</Atributo>
        <Atributo rotulo="Revisão da concessão">
          {ambiente.revisaoConcessao ?? "—"}
          {ambiente.ultimaConcessaoEmitidaEm
            ? ` · emitida em ${formatarData(ambiente.ultimaConcessaoEmitidaEm)}`
            : ""}
        </Atributo>
        <Atributo rotulo="Tenant key">
          <code>{ambiente.tenantKey}</code>
        </Atributo>
      </dl>
    </section>
  );
}

function BlocoEventos({ eventos }: { eventos: EventoProvisionamento[] }) {
  if (eventos.length === 0) {
    return (
      <section className="cartao">
        <h2>Provisionamento</h2>
        <p className="vazio">Nenhum evento registrado.</p>
      </section>
    );
  }

  return (
    <section className="cartao">
      <h2>Provisionamento — últimos eventos</h2>
      <ul className="eventos">
        {eventos.map((evento) => (
          <li key={evento.id} className={evento.status === "FALHOU" ? "evento-falhou" : undefined}>
            <div className="evento-linha">
              <strong>{evento.tipo}</strong>
              <span>{rotularStatus(evento.status)}</span>
              <small>{formatarData(evento.criadoEm)}</small>
            </div>
            {evento.etapaAtual && <small>Etapa: {evento.etapaAtual}</small>}
            {evento.tentativas > 1 && <small>{evento.tentativas} tentativas</small>}
            {/* Erro sanitizado: o backend já removeu credenciais antes de gravar. */}
            {evento.erroSanitizado && <p className="evento-erro">{evento.erroSanitizado}</p>}
            {evento.retomadaManualDisponivel && (
              <p className="evento-aviso">Esgotou as tentativas automáticas — exige retomada manual.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Assinante() {
  const { assinanteId } = useParams();
  const [assinante, setAssinante] = useState<DetalheAssinante | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api
      .get<DetalheAssinante>(`/assinantes/${assinanteId}`)
      .then((resposta) => {
        setAssinante(resposta.data);
        setErro("");
      })
      .catch((erroDaBusca) =>
        setErro(getApiErrorMessage(erroDaBusca, "Não foi possível carregar o assinante."))
      )
      .finally(() => setCarregando(false));
  }, [assinanteId]);

  if (carregando) return <p className="carregando">Carregando…</p>;
  if (erro) {
    return (
      <>
        <Mensagem texto={erro} />
        <Link to="/assinantes">Voltar para a lista</Link>
      </>
    );
  }
  if (!assinante) return null;

  return (
    <>
      <p className="migalha">
        <Link to="/assinantes">Assinantes</Link> · {assinante.slug}
      </p>

      <div className="linha-titulo">
        <h1>{assinante.nomeFantasia}</h1>
        <span className={`etiqueta etiqueta-${assinante.status.toLowerCase()}`}>
          {rotularStatus(assinante.status)}
        </span>
      </div>

      <div className="grade-larga">
        <section className="cartao">
          <h2>Cadastro</h2>
          <dl className="atributos">
            <Atributo rotulo="Razão social">{assinante.razaoSocial ?? "—"}</Atributo>
            <Atributo rotulo="Documento">{assinante.documento}</Atributo>
            <Atributo rotulo="Slug">{assinante.slug}</Atributo>
            <Atributo rotulo="E-mail de cobrança">{assinante.emailCobranca}</Atributo>
            <Atributo rotulo="Telefone">{assinante.telefone ?? "—"}</Atributo>
            <Atributo rotulo="Cadastrado em">{formatarData(assinante.criadoEm)}</Atributo>
          </dl>
        </section>

        {assinante.assinatura ? (
          <BlocoAssinatura assinatura={assinante.assinatura} />
        ) : (
          <section className="cartao">
            <h2>Assinatura vigente</h2>
            <p className="vazio">Nenhuma assinatura em vigor.</p>
          </section>
        )}

        {assinante.ambiente ? (
          <BlocoAmbiente ambiente={assinante.ambiente} />
        ) : (
          <section className="cartao">
            <h2>Ambiente</h2>
            <p className="vazio">Ainda não provisionado.</p>
          </section>
        )}

        <section className="cartao">
          <h2>Licenças por unidade</h2>
          {assinante.licencas.length === 0 ? (
            <p className="vazio">Nenhuma unidade licenciada.</p>
          ) : (
            <ul className="lista-simples">
              {assinante.licencas.map((licenca) => (
                <li key={licenca.id}>
                  <strong>{licenca.nomeExibicao ?? `Unidade ${licenca.tenantUnidadeId}`}</strong>
                  <span>{rotularStatus(licenca.status)}</span>
                  <small>
                    Início {formatarData(licenca.inicioCobrancaEm)}
                    {licenca.encerramentoCobrancaEm
                      ? ` · encerrada em ${formatarData(licenca.encerramentoCobrancaEm)}`
                      : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cartao">
          <h2>Contatos</h2>
          {assinante.contatos.length === 0 ? (
            <p className="vazio">Nenhum contato cadastrado.</p>
          ) : (
            <ul className="lista-simples">
              {assinante.contatos.map((contato) => (
                <li key={contato.id}>
                  <strong>
                    {contato.nome}
                    {contato.principal && <span className="etiqueta">principal</span>}
                  </strong>
                  <span>{rotularStatus(contato.tipo)}</span>
                  <small>{[contato.email, contato.telefone].filter(Boolean).join(" · ") || "—"}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {assinante.ambiente && <BlocoEventos eventos={assinante.ambiente.eventos} />}

        <section className="cartao cartao-largo">
          <h2>Faturas — últimas 12</h2>
          {assinante.faturas.length === 0 ? (
            <p className="vazio">Nenhuma fatura emitida.</p>
          ) : (
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th>Vencimento</th>
                    <th>Situação</th>
                    <th>Itens</th>
                    <th>Subtotal</th>
                    <th>Total</th>
                    <th>Paga em</th>
                  </tr>
                </thead>
                <tbody>
                  {assinante.faturas.map((fatura) => (
                    <tr key={fatura.id}>
                      <td>{fatura.competencia}</td>
                      <td>{formatarData(fatura.vencimentoEm)}</td>
                      <td>{rotularStatus(fatura.status)}</td>
                      <td>{fatura.totalItens}</td>
                      <td>{formatarCentavos(fatura.subtotalCentavos)}</td>
                      <td>{formatarCentavos(fatura.totalCentavos)}</td>
                      <td>{formatarData(fatura.pagaEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
