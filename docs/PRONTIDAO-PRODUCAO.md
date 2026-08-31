# Prontidão de produção

Estado auditado em 31 de agosto de 2026. `Implementado` descreve código
existente; não substitui validação manual do ambiente.

## Matriz atual

| Área | Estado | Evidência ou ação restante |
|---|---|---|
| Repositório independente | Implementado | `paulootavioti/control-plane` |
| CI API e painel | Implementado | PostgreSQL 16, migrations, testes, typecheck/lint e builds |
| Deploy reproduzível | Implementado | Netlify CLI fixado em `27.1.2` |
| Liveness e readiness | Validado | `/api/health` e `/api/ready` passam após deploy |
| Banco e migrações | Validado | 13 migrações aplicadas; workflow protegido |
| Bootstrap administrador | Preparado | executar workflow protegido em `main` |
| Login do operador | Implementado | falta validar com administrador real |
| Painel | Parcial | dashboard, assinantes e billing; demais operações somente API |
| Diretório multiproduto | Implementado | falta E2E com cada tenant plane |
| Concessão Ed25519 | Implementado | falta E2E de entrega/validação |
| Snapshot agregado | Implementado | falta E2E assinado com tenant real/de teste |
| Faturamento manual | Implementado | validar percurso snapshot -> fatura |
| Mercado Pago | Adiado | sem credenciais; worker e scheduler desligados |
| Notificações de billing | Adiado | transporte desligado |
| Provisionamento real | Bloqueado | Neon, cofre e provisionador precisam homologação |
| Fiscal | Não implementado | existe somente a abstração de provedor |
| Recuperação de senha | Não implementado | requisito antes de operação autônoma |
| Rate limit distribuído | Não implementado | login usa memória da instância serverless |
| CORS restritivo | Não implementado | API usa política aberta; restringir origens |
| Backup recuperável | Não comprovado | configurar rotina e testar restauração |
| Monitoramento/alertas externos | Não comprovado | definir alertas para 5xx, readiness e filas |

## Flags que devem permanecer desligadas

```text
PROVISIONAMENTO_REAL_HABILITADO=false
BILLING_WORKER_ENABLED=false
BILLING_WORKER_SCHEDULE_ENABLED ausente ou false
BILLING_NOTIFICATION_DELIVERY_ENABLED=false
BILLING_TEST_EVENTS_ENABLED=false
CONTROL_PLANE_DIRECTORY_LEGACY_ENABLED=false
```

## Checklist do primeiro go-live manual

- [x] Repositório, CI, deploy e banco independentes.
- [x] Migrações de produção aplicadas por workflow protegido.
- [x] Smoke test de liveness e banco depois do deploy.
- [ ] Configurar e executar o bootstrap do administrador.
- [ ] Validar login, expiração e invalidação de sessão.
- [ ] Restringir CORS às origens autorizadas.
- [ ] Definir recuperação segura de senha.
- [ ] Substituir ou complementar rate limit local com armazenamento distribuído.
- [ ] Configurar backup e executar restauração de teste.
- [ ] Configurar credenciais por produto e chave Ed25519 de concessão.
- [ ] Executar diretório + concessão + snapshot com tenant de teste.
- [ ] Criar plano, assinante, assinatura e fatura de teste.
- [ ] Configurar monitoramento e responsáveis por incidentes.
- [ ] Registrar decisão explícita para manter provisionamento e PSP desligados.

## Rollback

### Código/deploy

1. Identifique o último deploy saudável no Netlify.
2. Reimplante o commit anterior pelo workflow, sem alterar banco ou secrets.
3. Valide `/api/health` e `/api/ready`.
4. Não use `git reset --hard`, force-push ou exclusão do site como rollback.

### Migração

1. Pare novas escritas e workers.
2. Não improvise SQL reverso em produção.
3. Restaure o backup comprovado quando a migration não for compatível.
4. Reimplante a versão de aplicação compatível com o schema restaurado.

### Integrações

Desligue primeiro as flags do worker/scheduler. Preserve filas e eventos para
diagnóstico; não apague payloads ou registros falhos para “limpar” o painel.

## Próxima sequência recomendada

1. integrar e executar bootstrap;
2. restringir CORS e endurecer autenticação operacional;
3. implementar recuperação de senha;
4. adicionar rate limit distribuído;
5. realizar E2E do percurso manual com um tenant de teste;
6. configurar backup, restauração e alertas;
7. somente depois homologar provisionamento real e Mercado Pago.
