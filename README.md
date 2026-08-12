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

Operadores autenticados consultam assinantes por `GET /api/assinantes`, com
os filtros opcionais `busca`, `status`, `pagina` e `limite`. A resposta reúne
somente metadados B2B, assinatura corrente, ambiente e total de licenças;
nenhum dado operacional de alunos é lido pelo Control Plane.
O detalhe fica em `GET /api/assinantes/:assinanteId` e limita o histórico às
12 faturas mais recentes, sem retornar referências de segredo ou credenciais
do ambiente. Ele também retorna os 20 eventos de provisionamento mais recentes
com erro sanitizado e o indicador `retomadaManualDisponivel`, sem payload ou
chave de idempotência interna.

`POST /api/assinantes`, restrito a `OPERADOR` e `ADMIN_PLATAFORMA`, cadastra
uma organização inicialmente como `PROSPECT`. O comando não contrata plano nem
inicia provisionamento implicitamente; essas operações permanecem separadas.

`GET /api/planos` lista planos ativos e suas versões vigentes. Operadores podem
usar `incluirHistorico=true` para consultar planos inativos e versões
encerradas sem modificar o histórico comercial.

`POST /api/assinantes/:assinanteId/assinaturas` contrata uma versão vigente
para um prospect. O banco garante uma única assinatura corrente por assinante;
provisionamento continua sendo solicitado em comando separado.

`PATCH /api/assinantes/:assinanteId/assinaturas/:assinaturaId/status` aplica
transições comerciais explícitas. A resposta informa `ambienteId` e
`exigeEnvioConcessao`; a entrega permanece um comando separado para que falha
de rede não reverta a decisão comercial.

Cadastro, contratação e transição de assinatura gravam `AuditLogPlataforma`
na mesma transação da mudança. A trilha registra operador, origem, IP,
dispositivo, ação, alvo e alterações sanitizadas, sem documento, e-mail,
tokens ou credenciais.

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

Concessões são emitidas com revisão atômica e validade de 24 horas usando
`CONTROL_PLANE_GRANT_PRIVATE_KEY`. A chave pública correspondente é a única
parte configurada nos Tenant Planes.

## Netlify

Crie um site separado apontando o **base directory** para `control-plane`.
Configure `CONTROL_PLANE_DATABASE_URL` somente no ambiente desse site. O site
das academias não deve receber essa variável.
