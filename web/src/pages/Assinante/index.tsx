import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, EmptyState, ErrorMessage, Field, Input, PageHeader, Skeleton, StatusBadge, Table, Toast } from "../../components/ui";
import { api } from "../../services/api";
import { formatarCentavos, formatarData, rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import { motivoParaNaoContratar } from "../../utils/contratacao";
import { valoresVigentes, type Assinatura } from "../../utils/valoresDaAssinatura";
import { useAuth } from "../../contexts/useAuth";
import { FormularioContratacao } from "./FormularioContratacao";

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
  produto: { codigo: string; nome: string };
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

      <dl className="attribute-grid">
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

      <dl className="attribute-grid">
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
        <EmptyState title="Nenhum evento de provisionamento" description="Os eventos serão exibidos aqui quando o ambiente iniciar uma operação." />
      </section>
    );
  }

  return (
    <section className="cartao">
      <h2>Provisionamento — últimos eventos</h2>
      <ul className="timeline">
        {eventos.map((evento) => (
          <li key={evento.id} className={evento.status === "FALHOU" ? "event-failed" : undefined}>
            <div className="event-line">
              <strong>{evento.tipo}</strong>
              <StatusBadge status={evento.status}>{rotularStatus(evento.status)}</StatusBadge>
              <small>{formatarData(evento.criadoEm)}</small>
            </div>
            {evento.etapaAtual && <small>Etapa: {evento.etapaAtual}</small>}
            {evento.tentativas > 1 && <small>{evento.tentativas} tentativas</small>}
            {/* Erro sanitizado: o backend já removeu credenciais antes de gravar. */}
            {evento.erroSanitizado && <p className="event-error">{evento.erroSanitizado}</p>}
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
  const { podeVer } = useAuth();
  const [assinante, setAssinante] = useState<DetalheAssinante | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [mensagemAcao, setMensagemAcao] = useState("");
  const [tenantKeyExistente, setTenantKeyExistente] = useState("");
  const [schemaTenantExistente, setSchemaTenantExistente] = useState("3.0.2026.09.01");
  const [vinculandoTenant, setVinculandoTenant] = useState(false);
  const [editandoCadastro, setEditandoCadastro] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [cadastro, setCadastro] = useState({ nomeFantasia: "", razaoSocial: "", documento: "", slug: "", emailCobranca: "", telefone: "" });

  function iniciarEdicaoCadastro() {
    if (!assinante) return;
    setCadastro({
      nomeFantasia: assinante.nomeFantasia,
      razaoSocial: assinante.razaoSocial ?? "",
      documento: assinante.documento,
      slug: assinante.slug,
      emailCobranca: assinante.emailCobranca,
      telefone: assinante.telefone ?? "",
    });
    setEditandoCadastro(true);
  }

  async function salvarCadastro() {
    if (!assinante) return;
    setSalvandoCadastro(true);
    try {
      await api.patch(`/assinantes/${assinante.id}`, {
        nomeFantasia: cadastro.nomeFantasia,
        razaoSocial: cadastro.razaoSocial || null,
        documento: cadastro.documento,
        slug: cadastro.slug,
        emailCobranca: cadastro.emailCobranca,
        telefone: cadastro.telefone || null,
      });
      setEditandoCadastro(false);
      setMensagemAcao("Cadastro do assinante atualizado.");
      setRecarga((valor) => valor + 1);
    } catch (erroDaAcao) { setErro(getApiErrorMessage(erroDaAcao, "Não foi possível atualizar o assinante.")); }
    finally { setSalvandoCadastro(false); }
  }

  async function vincularTenantCompartilhado() {
    if (!assinante) return;
    setVinculandoTenant(true);
    try {
      await api.post(`/assinantes/${assinante.id}/tenant-compartilhado`, {
        tenantKey: tenantKeyExistente.trim(), schemaVersao: schemaTenantExistente.trim(),
      });
      setMensagemAcao("Tenant compartilhado vinculado. Ele será ativado somente após a contratação.");
      setRecarga((valor) => valor + 1);
    } catch (erroDaAcao) { setErro(getApiErrorMessage(erroDaAcao, "Não foi possível vincular o tenant compartilhado.")); }
    finally { setVinculandoTenant(false); }
  }

  async function enviarConcessao() {
    if (!assinante?.ambiente) return;
    try {
      const resposta = await api.post<{ revisao: number; expiraEm: string }>(`/concessoes/${assinante.ambiente.id}/enviar`);
      setMensagemAcao(`Concessão revisão ${resposta.data.revisao} enviada; expira em ${formatarData(resposta.data.expiraEm)}.`);
      setRecarga((valor) => valor + 1);
    } catch (erroDaAcao) { setErro(getApiErrorMessage(erroDaAcao, "Não foi possível enviar a concessão.")); }
  }

  async function retomar(eventoId: string) {
    try {
      await api.post(`/provisionamento/solicitacoes/${eventoId}/retomar`);
      setMensagemAcao("Evento devolvido à fila de provisionamento.");
      setRecarga((valor) => valor + 1);
    } catch (erroDaAcao) { setErro(getApiErrorMessage(erroDaAcao, "Não foi possível retomar o evento.")); }
  }

  // `recarga` existe só para refazer a busca depois de uma contratação, sem
  // precisar recarregar a página inteira e perder a posição de rolagem.
  const [recarga, setRecarga] = useState(0);

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
  }, [assinanteId, recarga]);

  if (carregando) return <><PageHeader kicker="Assinantes · Carregando" title="Detalhe da conta" /><Skeleton rows={7} /></>;
  if (erro) {
    return (
      <>
        <ErrorMessage message={erro} />
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

      <PageHeader kicker={`Conta · ${assinante.slug}`} title={assinante.nomeFantasia} badge={<StatusBadge status={assinante.status}>{rotularStatus(assinante.status)}</StatusBadge>} />
      <Toast message={mensagemAcao} />

      <div className="grade-larga">
        <section className="cartao">
          <h2>Cadastro</h2>
          {editandoCadastro ? (
            <div className="form-grid">
              <Field id="assinante-nome" label="Nome fantasia"><Input id="assinante-nome" value={cadastro.nomeFantasia} onChange={(e) => setCadastro({ ...cadastro, nomeFantasia: e.target.value })} /></Field>
              <Field id="assinante-razao" label="Razão social"><Input id="assinante-razao" value={cadastro.razaoSocial} onChange={(e) => setCadastro({ ...cadastro, razaoSocial: e.target.value })} /></Field>
              <Field id="assinante-documento" label="Documento"><Input id="assinante-documento" value={cadastro.documento} onChange={(e) => setCadastro({ ...cadastro, documento: e.target.value })} /></Field>
              <Field id="assinante-slug" label="Slug"><Input id="assinante-slug" value={cadastro.slug} onChange={(e) => setCadastro({ ...cadastro, slug: e.target.value })} /></Field>
              <Field id="assinante-email" label="E-mail de cobrança"><Input id="assinante-email" type="email" value={cadastro.emailCobranca} onChange={(e) => setCadastro({ ...cadastro, emailCobranca: e.target.value })} /></Field>
              <Field id="assinante-telefone" label="Telefone"><Input id="assinante-telefone" value={cadastro.telefone} onChange={(e) => setCadastro({ ...cadastro, telefone: e.target.value })} /></Field>
              <div><Button variant="secondary" disabled={salvandoCadastro} onClick={() => setEditandoCadastro(false)}>Cancelar</Button> <Button disabled={salvandoCadastro} onClick={salvarCadastro}>{salvandoCadastro ? "Salvando…" : "Salvar cadastro"}</Button></div>
            </div>
          ) : <><dl className="attribute-grid">
            <Atributo rotulo="Produto">{assinante.produto.nome}</Atributo>
            <Atributo rotulo="Razão social">{assinante.razaoSocial ?? "—"}</Atributo>
            <Atributo rotulo="Documento">{assinante.documento}</Atributo>
            <Atributo rotulo="Slug">{assinante.slug}</Atributo>
            <Atributo rotulo="E-mail de cobrança">{assinante.emailCobranca}</Atributo>
            <Atributo rotulo="Telefone">{assinante.telefone ?? "—"}</Atributo>
            <Atributo rotulo="Cadastrado em">{formatarData(assinante.criadoEm)}</Atributo>
          </dl>{podeVer(["OPERADOR", "ADMIN_PLATAFORMA"]) && <Button variant="secondary" onClick={iniciarEdicaoCadastro}>Editar cadastro</Button>}</>}
        </section>

        {assinante.assinatura ? (
          <BlocoAssinatura assinatura={assinante.assinatura} />
        ) : (
          <section className="cartao">
            <h2>Assinatura vigente</h2>
            <p className="vazio">
              {motivoParaNaoContratar(assinante) ?? "Nenhuma assinatura em vigor."}
            </p>
          </section>
        )}

        {assinante.ambiente ? (
          <><BlocoAmbiente ambiente={assinante.ambiente} />{podeVer(["OPERADOR", "ADMIN_PLATAFORMA"]) && (
            assinante.ambiente.status === "ATIVO" && assinante.assinatura
              ? <Button variant="secondary" onClick={enviarConcessao}>Reenviar concessão</Button>
              : <p className="vazio">A concessão ficará disponível quando a assinatura e o ambiente estiverem ativos.</p>
          )}</>
        ) : (
          <section className="cartao">
            <h2>Ambiente</h2>
            <p className="vazio">Ainda não provisionado.</p>
          </section>
        )}

        {!assinante.ambiente && assinante.status === "PROSPECT" && assinante.produto.codigo === "sysbelt" &&
          podeVer(["ADMIN_PLATAFORMA"]) && (
            <section className="cartao">
              <h2>Vincular tenant existente</h2>
              <p>Use a identidade técnica da conta já existente no banco compartilhado do SysBelt.</p>
              <Field id="tenant-key-existente" label="Tenant key">
                <Input id="tenant-key-existente" value={tenantKeyExistente} onChange={(evento) => setTenantKeyExistente(evento.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              </Field>
              <Field id="schema-tenant-existente" label="Versão do schema">
                <Input id="schema-tenant-existente" value={schemaTenantExistente} onChange={(evento) => setSchemaTenantExistente(evento.target.value)} />
              </Field>
              <Button disabled={vinculandoTenant || !tenantKeyExistente.trim() || !schemaTenantExistente.trim()} onClick={vincularTenantCompartilhado}>
                {vinculandoTenant ? "Vinculando…" : "Vincular tenant existente"}
              </Button>
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
                    {contato.principal && <StatusBadge status="ativo">principal</StatusBadge>}
                  </strong>
                  <span>{rotularStatus(contato.tipo)}</span>
                  <small>{[contato.email, contato.telefone].filter(Boolean).join(" · ") || "—"}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {assinante.ambiente && <><BlocoEventos eventos={assinante.ambiente.eventos} />{assinante.ambiente.eventos.filter((evento) => evento.retomadaManualDisponivel).map((evento) => <Button key={evento.id} variant="secondary" onClick={() => retomar(evento.id)}>Retomar {evento.tipo}</Button>)}</>}

        {/* Contratar é ação de OPERADOR e ADMIN_PLATAFORMA — os mesmos perfis
            que a rota exige. Esconder para os demais evita oferecer um botão
            que o servidor recusaria; ele continua sendo quem autoriza. */}
        {motivoParaNaoContratar(assinante) === null &&
          podeVer(["OPERADOR", "ADMIN_PLATAFORMA"]) && (
            <FormularioContratacao
              assinanteId={assinante.id}
              produto={assinante.produto.codigo}
              aoContratar={() => setRecarga((atual) => atual + 1)}
            />
          )}

        <section className="cartao cartao-largo">
          <h2>Faturas — últimas 12</h2>
          {assinante.faturas.length === 0 ? (
            <p className="vazio">Nenhuma fatura emitida.</p>
          ) : (
            <Table label="Últimas doze faturas">
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
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
