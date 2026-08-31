# Visão geral do Control Plane

## Responsabilidade

O Control Plane é o sistema B2B compartilhado por SysBelt, Mecanix e Psyché.
Ele mantém a verdade comercial e operacional da plataforma: produtos, planos,
assinantes, assinaturas, faturas, diretório de tenants, concessões, inventário
de ambientes, auditoria e filas de integração.

Ele não armazena prontuários, atendimentos, alunos, ordens de serviço ou outros
dados operacionais dos tenant planes. O único dado de uso recebido atualmente é
um snapshot agregado de unidades e quantidade de alunos ativos.

## Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| API | Express + TypeScript | Regras comerciais, autenticação, integrações e operação |
| Painel | React + Vite | Dashboard, assinantes e operação de billing |
| Banco | PostgreSQL + Prisma | Estado comercial, filas, auditoria e idempotência |
| Função `api` | Netlify Functions | Expõe a API sob `/api/*` |
| Função `provisionar-background` | Netlify Functions | Consome a fila de provisionamento quando habilitada |
| Função `billing-background` | Netlify Functions | Processa webhook, dunning, reconciliação e notificações |
| GitHub Actions | CI/CD | Testes, deploy, migrações, bootstrap e agendamento do billing |

## Fronteiras e fluxos

```text
Operador -> Painel -> API -> PostgreSQL
Tenant Plane -> snapshot assinado -> API -> PostgreSQL
Tenant Plane -> diretório autenticado -> API -> PostgreSQL
Control Plane -> concessão Ed25519 -> Tenant Plane
Mercado Pago -> webhook HMAC -> API -> fila de billing
GitHub Actions -> função interna autenticada -> workers
Worker de provisionamento -> Neon + AWS Secrets + provisionador isolado
```

As integrações usam projeções mínimas. Connection strings, chaves privadas,
tokens do PSP e payloads internos não são devolvidos nas consultas operacionais.

## Produtos e política de inadimplência

O catálogo contém `sysbelt`, `mecanix` e `psyche`. Planos e assinaturas são
vinculados ao produto. No Psyché, inadimplência financeira restringe funções
administrativas, mas não bloqueia funções clínicas. Essa política é carregada
na concessão e deve ser aplicada pelo tenant plane.

## Autenticação e autorização

Operadores usam JWT Bearer. O token contém identificador, perfil e versão de
sessão; alterações de senha, perfil ou estado invalidam tokens anteriores.
Perfis disponíveis:

- `ADMIN_PLATAFORMA`: administração completa e auditoria;
- `OPERADOR`: cadastro e operação comercial;
- `FINANCEIRO`: faturas, indicadores financeiros e billing;
- `SUPORTE`: inventário e diagnóstico de ambientes.

Integrações máquina-a-máquina não usam o JWT do operador:

- diretório: credencial versionada e separada por produto;
- snapshots: assinatura Ed25519 do tenant e janela de cinco minutos;
- concessões: assinatura Ed25519 do Control Plane;
- workers: `CONTROL_PLANE_WORKER_SECRET`;
- Mercado Pago: `x-signature`, `x-request-id` e segredo do webhook.

## Estados persistidos

O schema possui 13 migrações. Os principais agregados são `Produto`,
`Assinante`, `Plano`, `PlanoVersao`, `Assinatura`, `Fatura`, `TenantProduto`,
`AmbienteTenant`, `EventoProvisionamento`, `LicencaUnidade`,
`SnapshotContagem`, `EventoWebhookPagamento`, `TentativaDunning`,
`NotificacaoBilling`, `ExecucaoWorkerBilling` e `AuditLogPlataforma`.

Versões de plano e snapshots de cobrança são históricos imutáveis. Operações
repetíveis usam chaves únicas, transações e respostas idempotentes.

## Superfícies disponíveis

O painel web oferece login, visão executiva, lista/detalhe de assinantes e
operação de billing. A API possui capacidades adicionais de planos, operadores,
faturas, contatos, assinaturas, auditoria, integração e provisionamento. Até
essas telas existirem, essas operações exigem cliente HTTP autorizado.

Consulte [API-E-PERMISSOES.md](API-E-PERMISSOES.md) para o catálogo e
[PERCURSO-OPERACIONAL.md](PERCURSO-OPERACIONAL.md) para a jornada completa.

## Estado operacional em 31 de agosto de 2026

- produção: `https://sysbelt-control-plane.netlify.app`;
- liveness e prontidão do banco validados automaticamente após deploy;
- 13 migrações aplicadas e schema atualizado;
- billing, entrega de notificações e provisionamento real desligados por flags;
- Mercado Pago preparado no código, sem credenciais;
- workflow protegido de bootstrap incluído e ainda não executado.

O checklist atualizado está em
[PRONTIDAO-PRODUCAO.md](PRONTIDAO-PRODUCAO.md).
