# SysBelt Control Plane

Aplicação independente que administra assinantes, planos, assinaturas,
provisionamento e a saúde comercial da plataforma B2B. Ela não armazena os
dados operacionais das academias.

## Fronteiras

- possui banco PostgreSQL e credenciais próprios;
- possui build e deploy Netlify próprios;
- não importa código da API do Tenant Plane;
- integra-se com cada academia somente por contratos versionados;
- nesta primeira etapa, expõe apenas `GET /api/health` no Netlify e
  `GET /health` durante o desenvolvimento local.

## Desenvolvimento local

Requer Node.js 20 ou superior.

```bash
cp .env.example .env
npm install
npm run dev
```

O schema comercial contém assinantes, contatos, planos versionados,
assinaturas e faturas com memória de cálculo por unidade. A URL registra a
fronteira exclusiva do banco; a rota de health check não abre conexão.

## Operador inicial

Depois de aplicar as migrations, defina as variáveis `CONTROL_PLANE_ADMIN_*`
e execute `npm run seed:operator` uma única vez. Não há usuário ou senha padrão.
O login usa `POST /api/auth/login` e a sessão pode ser consultada em
`GET /api/auth/me`.

Depois do bootstrap, somente `ADMIN_PLATAFORMA` cadastra novos operadores por
`POST /api/operadores`. A senha é armazenada exclusivamente como hash e nunca
aparece na resposta ou auditoria; o log registra apenas perfil e estado ativo.
O mesmo perfil consulta `GET /api/operadores`, com paginação e filtros por
nome/e-mail, perfil e estado ativo, sem receber hash ou versão de sessão.
Também pode usar `PATCH /api/operadores/:operadorId/status` para ativar ou
desativar terceiros. A mudança invalida sessões existentes, impede
autodesativação e preserva ao menos um administrador ativo.
`PATCH /api/operadores/:operadorId/senha` redefine a senha e invalida todas as
sessões anteriores. A senha e seu hash nunca são retornados nem auditados.
`PATCH /api/operadores/:operadorId` altera nome, e-mail e perfil, invalida as
sessões anteriores e audita somente os valores alterados. É permitido editar o
próprio nome/e-mail, mas não rebaixar o próprio perfil nem o último
administrador ativo.

Operadores autenticados consultam assinantes por `GET /api/assinantes`, com
os filtros opcionais `busca`, `status`, `pagina` e `limite`. A resposta reúne
somente metadados B2B, assinatura corrente, ambiente e total de licenças;
nenhum dado operacional de alunos é lido pelo Control Plane.
O detalhe fica em `GET /api/assinantes/:assinanteId` e limita o histórico às
12 faturas mais recentes, sem retornar referências de segredo ou credenciais
do ambiente. Ele também retorna os 20 eventos de provisionamento mais recentes
com erro sanitizado e o indicador `retomadaManualDisponivel`, sem payload ou
chave de idempotência interna.

O inventário B2B em `GET /api/assinaturas` oferece paginação e filtros por
assinante, plano, status, nome/slug e períodos de teste ou encerramento. A
resposta limita o assinante à identificação mínima e traz versão do plano,
condições comerciais estruturadas e total de faturas, sem documento, e-mail de
cobrança, segredos ou política de cobrança livre.

`POST /api/assinantes`, restrito a `OPERADOR` e `ADMIN_PLATAFORMA`, cadastra
uma organização inicialmente como `PROSPECT`. O comando não contrata plano nem
inicia provisionamento implicitamente; essas operações permanecem separadas.

`GET /api/planos` lista planos ativos e suas versões vigentes. Operadores podem
usar `incluirHistorico=true` para consultar planos inativos e versões
encerradas sem modificar o histórico comercial.

`POST /api/planos`, exclusivo de `ADMIN_PLATAFORMA`, cria o plano ativo e sua
primeira versão comercial em uma única transação. A versão inicial é sempre
`1`; condições já publicadas não são atualizadas, e futuras mudanças devem
gerar uma nova versão. Nome duplicado retorna conflito e a auditoria registra
as condições comerciais sem copiar metadados comerciais livres.

`POST /api/planos/:planoId/versoes`, também exclusivo de
`ADMIN_PLATAFORMA`, publica a próxima versão comercial de um plano ativo. A
operação usa transação serializável, rejeita vigências sobrepostas e encerra
uma versão anterior aberta no início da nova. Repetir exatamente a mesma
publicação é idempotente; preços, limites, recursos e metadados de versões já
publicadas nunca são reescritos. A auditoria não copia metadados comerciais
livres.

`POST /api/assinantes/:assinanteId/assinaturas` contrata uma versão vigente
para um prospect. O banco garante uma única assinatura corrente por assinante;
provisionamento continua sendo solicitado em comando separado.

`POST /api/assinantes/:assinanteId/assinaturas/:assinaturaId/trocar-plano`
troca uma assinatura corrente para a versão vigente de outro plano ativo. A
operação serializável encerra a assinatura anterior e cria uma nova, preserva
status, vencimento, período de teste e condições negociadas, sem reescrever o
histórico usado pelas faturas. Repetições são idempotentes e a troca gera uma
auditoria sanitizada; conflitos concorrentes retornam conflito.

`PATCH /api/assinantes/:assinanteId/assinaturas/:assinaturaId/status` aplica
transições comerciais explícitas. A resposta informa `ambienteId` e
`exigeEnvioConcessao`; a entrega permanece um comando separado para que falha
de rede não reverta a decisão comercial.

Cadastro, contratação e transição de assinatura gravam `AuditLogPlataforma`
na mesma transação da mudança. A trilha registra operador, origem, IP,
dispositivo, ação, alvo e alterações sanitizadas, sem documento, e-mail,
tokens ou credenciais.

Administradores da plataforma consultam `GET /api/auditoria`, com paginação e
filtros por assinante, operador, ação, alvo e período. A resposta inclui IP e
dispositivo para investigação, mas não seleciona e-mail do operador, senha,
documento, e-mail de cobrança, token ou referência de segredo.

O resumo executivo em `GET /api/dashboard/resumo`, exclusivo para
`ADMIN_PLATAFORMA`, agrega quantidades de assinantes, ambientes e licenças por
status, além da quantidade e do valor total das faturas em cada estado. Nenhum
dado operacional de alunos é consultado para formar esses indicadores.

Financeiro e administradores consultam `GET /api/dashboard/financeiro`, com
filtros opcionais por assinante, competência e período de vencimento. O retorno
agrega quantidade e valor em centavos por status e consolida recebíveis
(`ABERTA` + `VENCIDA`), recebidos, estornados, cancelados e rascunhos, sempre
preenchendo estados sem movimento com zero. A consulta usa somente faturas do
Control Plane e não acessa alunos ou dados operacionais dos tenants.

Operadores financeiros e administradores geram um rascunho idempotente por
`POST /api/faturas/gerar`, informando assinante e competência. O cálculo usa o
snapshot agregado mais recente do mês, cobra somente licenças ativas, aplica o
mínimo por unidade e congela preços e memória de cálculo. Sem snapshot, nenhuma
estimativa ou fatura é criada.

Operadores autenticados consultam `GET /api/faturas`, com paginação e filtros
por assinante, status, competência e período de vencimento. A listagem retorna
somente o resumo comercial; memória de cálculo e snapshots ficam no detalhe.

Operadores financeiros e administradores consultam `GET /api/integracao/contagens`,
com paginação e filtros por assinante e período da data de corte. Cada snapshot
retorna somente o assinante mínimo e as contagens agregadas por unidade e licença;
nenhum aluno individual, documento, e-mail de cobrança, segredo ou credencial é
selecionado.

Operadores, financeiro, suporte e administradores consultam o inventário global
em `GET /api/integracao/licencas`, com paginação e filtros por assinante, status,
nome ou identificador da unidade e período de sincronização. O filtro
`desatualizadaAntes` também inclui licenças nunca sincronizadas e não pode ser
combinado com o período. A resposta contém apenas identificação, estado, datas
de cobrança e última sincronização, junto ao assinante mínimo; nenhum aluno,
documento, e-mail, segredo ou credencial é selecionado.

Após revisão, `POST /api/faturas/:faturaId/emitir` faz a transição idempotente
de `RASCUNHO` para `ABERTA`, registra a data e a auditoria na mesma transação.
A emissão comercial não chama gateway neste passo; cobrança externa e webhooks
permanecem integrações posteriores.

`GET /api/faturas/:faturaId` retorna a revisão completa da cobrança: valores,
estado, plano e condições congeladas, além da memória agregada por unidade.
O detalhe não consulta nem expõe alunos individuais ou credenciais do tenant.

`POST /api/faturas/:faturaId/cancelar` exige motivo e permite cancelar apenas
faturas em `RASCUNHO` ou `ABERTA`. A operação é idempotente, protegida contra
concorrência e auditada; faturas pagas, vencidas ou estornadas são preservadas.

`POST /api/faturas/:faturaId/pagar` registra pagamento de fatura `ABERTA` ou
`VENCIDA`, com gateway e referência única. Repetir a mesma confirmação é
idempotente; referências reutilizadas ou uma segunda baixa são recusadas. A
regularização comercial segue as regras descritas abaixo.

Quando a assinatura está `INADIMPLENTE`, a baixa verifica outras faturas
vencidas na mesma transação. Sem pendências restantes, ela volta para `ATIVA`
e a resposta informa `exigeEnvioConcessao`; assinaturas `SUSPENSA` ou
`CANCELADA`, assim como ambientes suspensos ou desativados, nunca são
reativados automaticamente.

`POST /api/faturas/:faturaId/estornar` exige motivo e permite apenas a
transição `PAGA → ESTORNADA`. A referência original é preservada para
conciliação, e a resposta exige revisão comercial; assinatura e acesso não são
alterados automaticamente pelo estorno.

`POST /api/faturas/marcar-vencidas` processa até 100 faturas `ABERTA` cujo
vencimento já passou, mudando-as para `VENCIDA` e auditando cada transição. O
comando é idempotente, ignora alterações concorrentes e informa `possuiMais`
quando outro lote deve ser executado.

## Worker de provisionamento

A função `provisionar-background` é protegida por
`CONTROL_PLANE_WORKER_SECRET`. Por segurança,
`PROVISIONAMENTO_REAL_HABILITADO` deve permanecer `false` até os adaptadores
Neon e do cofre de segredos estarem configurados e validados. Enquanto isso,
a função não adquire nem altera eventos da fila.

Ao concluir todas as etapas, o worker ativa ambiente e assinante na mesma
transação. Falhas temporárias permanecem disponíveis para retomada; somente o
esgotamento das cinco tentativas muda o assinante para
`ERRO_PROVISIONAMENTO`.

Após corrigir a causa, um operador pode usar
`POST /api/provisionamento/solicitacoes/:eventoId/retomar`. O comando exige
assinatura em teste ou ativa, reabre o mesmo evento de forma idempotente,
preserva a última etapa concluída e registra auditoria; nenhum banco adicional
é criado.

Operadores com perfil `OPERADOR` ou `ADMIN_PLATAFORMA` podem criar a
solicitação idempotente por `POST /api/provisionamento/solicitacoes`. A rota
exige uma assinatura corrente em teste ou ativa e registra ambiente, evento e
auditoria na mesma transação; ela não habilita os adaptadores reais.

Operadores, suporte e administradores consultam a fila global por
`GET /api/provisionamento/eventos`, com paginação e filtros por assinante,
status, tipo e período. A resposta informa quando a retomada manual está
disponível e traz somente o contexto operacional mínimo do ambiente e do
assinante; payload, chave de idempotência, referência de segredo e chave
pública nunca são selecionados.

Os mesmos perfis consultam o inventário por
`GET /api/provisionamento/ambientes`, com paginação e filtros por assinante,
status, provedor, região e divergência de schema. A resposta reúne versões,
datas de saúde, backup, migração e rotação, além do último evento e dos
indicadores de atenção e retomada. Identificadores do provedor e do banco,
credenciais, referências de segredo e dados comerciais sensíveis do assinante
não são selecionados.

Concessões são emitidas com revisão atômica e validade de 24 horas usando
`CONTROL_PLANE_GRANT_PRIVATE_KEY`. A chave pública correspondente é a única
parte configurada nos Tenant Planes.

## Netlify

Crie um site separado apontando o **base directory** para `control-plane`.
Configure `CONTROL_PLANE_DATABASE_URL` somente no ambiente desse site. O site
das academias não deve receber essa variável.
