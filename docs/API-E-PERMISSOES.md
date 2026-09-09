# API e permissões

Em produção, todos os caminhos abaixo recebem o prefixo `/api`. `Autenticado`
significa qualquer operador ativo; listas entre parênteses restringem os
perfis. Respostas `400`, `401`, `404` e `409` representam respectivamente
entrada inválida, autenticação inválida, recurso ausente e conflito de estado.

## Saúde e autenticação

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `GET /health` | Público | Liveness, sem consultar o banco |
| `GET /ready` | Público | `SELECT 1`; responde 503 sem detalhes se o banco falhar |
| `POST /auth/login` | Público, 10 tentativas/15 min | Emite JWT do operador |
| `GET /auth/me` | Autenticado | Consulta a sessão atual |

## Operadores e auditoria

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `GET /operadores` | `ADMIN_PLATAFORMA` | Listar e filtrar operadores |
| `GET /operadores/:id` | `ADMIN_PLATAFORMA` | Detalhe e ações recentes |
| `POST /operadores` | `ADMIN_PLATAFORMA` | Criar operador |
| `PATCH /operadores/:id` | `ADMIN_PLATAFORMA` | Nome, e-mail e perfil |
| `PATCH /operadores/:id/senha` | `ADMIN_PLATAFORMA` | Redefinir senha e invalidar sessões |
| `PATCH /operadores/:id/status` | `ADMIN_PLATAFORMA` | Ativar ou desativar |
| `GET /auditoria` | `ADMIN_PLATAFORMA` | Consultar trilha auditável |
| `GET /auditoria/:id` | `ADMIN_PLATAFORMA` | Detalhar um registro |

## Catálogo comercial

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `POST /solicitacoes` | Público, chave por produto, limite por IP/produto | Receber intenção sem criar assinante |
| `GET /solicitacoes` | Autenticado | Fila paginada e filtrável |
| `POST /solicitacoes/:id/aprovar` | `OPERADOR`, `ADMIN_PLATAFORMA` | Aprovar de forma idempotente |
| `POST /solicitacoes/:id/recusar` | `OPERADOR`, `ADMIN_PLATAFORMA` | Recusar com motivo obrigatório |
| `POST /solicitacoes/:id/converter` | `OPERADOR`, `ADMIN_PLATAFORMA` | Criar prospect e contato principal |
| `GET /planos` | Autenticado | Planos vigentes ou histórico |
| `GET /planos/:id` | Autenticado | Plano e versões |
| `POST /planos` | `ADMIN_PLATAFORMA` | Criar plano e versão inicial |
| `POST /planos/:id/versoes` | `ADMIN_PLATAFORMA` | Publicar versão imutável |
| `PATCH /planos/:id/status` | `ADMIN_PLATAFORMA` | Ativar ou desativar plano |
| `GET /assinantes` | Autenticado | Listar assinantes |
| `GET /assinantes/:id` | Autenticado | Detalhe comercial e operacional |
| `POST /assinantes` | `OPERADOR`, `ADMIN_PLATAFORMA` | Cadastrar prospect |
| `PATCH /assinantes/:id` | `OPERADOR`, `ADMIN_PLATAFORMA` | Atualizar dados comerciais |
| `POST /assinantes/:id/contatos` | `OPERADOR`, `ADMIN_PLATAFORMA` | Criar contato |
| `PATCH /assinantes/:id/contatos/:contatoId` | `OPERADOR`, `ADMIN_PLATAFORMA` | Atualizar contato |
| `DELETE /assinantes/:id/contatos/:contatoId` | `OPERADOR`, `ADMIN_PLATAFORMA` | Remover contato |
| `POST /assinantes/:id/assinaturas` | `OPERADOR`, `ADMIN_PLATAFORMA` | Contratar plano |
| `POST /assinantes/:id/assinaturas/:assinaturaId/trocar-plano` | `OPERADOR`, `ADMIN_PLATAFORMA` | Trocar plano preservando histórico |
| `PATCH /assinantes/:id/assinaturas/:assinaturaId/status` | `OPERADOR`, `ADMIN_PLATAFORMA` | Aplicar transição comercial |
| `GET /assinaturas` | Todos os perfis | Inventário de assinaturas |
| `GET /assinaturas/:id` | Todos os perfis | Detalhe de assinatura |
| `GET /contatos` | Todos os perfis | Inventário de contatos |
| `GET /contatos/:id` | Todos os perfis | Detalhe de contato |

## Faturas e indicadores

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `GET /faturas` | Autenticado | Listar faturas |
| `GET /faturas/:id` | Autenticado | Revisar cálculo e itens |
| `POST /faturas/gerar` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Gerar rascunho por competência |
| `POST /faturas/:id/emitir` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Abrir fatura |
| `POST /faturas/:id/pagar` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Registrar baixa manual/externa |
| `POST /faturas/:id/cancelar` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Cancelar rascunho ou aberta |
| `POST /faturas/:id/estornar` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Estornar pagamento |
| `POST /faturas/marcar-vencidas` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Atualizar vencimentos em lote |
| `GET /dashboard/resumo` | `ADMIN_PLATAFORMA` | Resumo executivo |
| `GET /dashboard/financeiro` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Consolidação financeira |
| `GET /dashboard/frota` | `SUPORTE`, `ADMIN_PLATAFORMA` | Saúde dos ambientes |

## Inventário, diretório e concessões

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `GET /integracao/licencas` | Todos os perfis | Licenças por unidade |
| `GET /integracao/licencas/:id` | Todos os perfis | Licença e contagens recentes |
| `GET /integracao/contagens` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Snapshots agregados |
| `GET /integracao/contagens/:id` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Detalhe de snapshot |
| `POST /integracao/v1/contagens` | Tenant com Ed25519 | Receber snapshot idempotente |
| `GET /diretorio/v1/produtos/:produto/tenants/:slug` | Credencial do produto | Resolver tenant multiproduto |
| `GET /diretorio/v1/tenants/:slug` | Legado opcional | Compatibilidade temporária SysBelt |
| `POST /concessoes/:ambienteId/enviar` | `OPERADOR`, `ADMIN_PLATAFORMA` | Assinar e entregar concessão |

## Provisionamento

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `GET /provisionamento/ambientes` | `OPERADOR`, `SUPORTE`, `ADMIN_PLATAFORMA` | Inventário de ambientes |
| `GET /provisionamento/ambientes/:id` | Mesmos perfis | Detalhe sanitizado |
| `GET /provisionamento/eventos` | Mesmos perfis | Fila e histórico |
| `GET /provisionamento/eventos/:id` | Mesmos perfis | Diagnóstico sanitizado |
| `POST /provisionamento/solicitacoes` | `OPERADOR`, `ADMIN_PLATAFORMA` | Solicitar ambiente |
| `POST /provisionamento/solicitacoes/:eventoId/retomar` | `OPERADOR`, `ADMIN_PLATAFORMA` | Retomar falha elegível |
| `POST /provisionamento/ambientes/:id/migrations` | `ADMIN_PLATAFORMA` | Solicitar versão de schema |
| `POST /provisionamento/ambientes/:id/rotacionar-credencial` | `ADMIN_PLATAFORMA` | Solicitar rotação |
| `POST /provisionamento/ambientes/:id/suspender` | `ADMIN_PLATAFORMA` | Suspender ambiente |
| `POST /provisionamento/ambientes/:id/reativar` | `ADMIN_PLATAFORMA` | Reativar ambiente elegível |
| `POST /.netlify/functions/provisionar-background` | Segredo interno | Consumir fila quando habilitada |

`PROVISIONAMENTO_REAL_HABILITADO=false` impede o worker de adquirir eventos.
A contratação registra automaticamente o evento na mesma transação, mas não
cria infraestrutura enquanto essa flag estiver desligada.

## Billing

| Método e caminho | Acesso | Finalidade |
|---|---|---|
| `GET /billing/operacao/prontidao` | `FINANCEIRO`, `ADMIN_PLATAFORMA` | Checklist sem revelar valores |
| `GET /billing/operacao/mercado-pago/webhook` | Mesmos perfis | Evidência do último webhook assinado |
| `POST /billing/operacao/mercado-pago/validar` | Mesmos perfis | Validar credencial sem cobrar |
| `GET /billing/operacao/resumo` | Mesmos perfis | Contagens das filas |
| `GET /billing/operacao/falhas` | Mesmos perfis | Falhas sanitizadas |
| `GET /billing/operacao/execucoes` | Mesmos perfis | Histórico do worker |
| `POST /billing/operacao/webhooks/:id/reprocessar` | Mesmos perfis | Retomar webhook falho |
| `POST /billing/operacao/dunning/:id/reprocessar` | Mesmos perfis | Retomar passo falho |
| `POST /billing/operacao/notificacoes/:id/reprocessar` | Mesmos perfis | Retomar notificação falha |
| `POST /billing/assinaturas/:id/iniciar` | Mesmos perfis | Criar preapproval no PSP |
| `POST /billing/assinaturas/:id/reconciliar` | Mesmos perfis | Consultar estado remoto |
| `POST /billing/webhooks/mercado-pago` | Assinatura HMAC | Persistir evento do PSP |
| `POST /billing/test/eventos` | Flag + segredo interno | Evento de contrato não produtivo |
| `POST /.netlify/functions/billing-background` | Segredo interno | Executar ciclo quando habilitado |

Enquanto as credenciais não forem configuradas, não invoque as rotas de PSP.
O workflow agendado permanece ignorado com
`BILLING_WORKER_SCHEDULE_ENABLED != true`.
