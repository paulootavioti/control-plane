# Percurso operacional ponta a ponta

Este roteiro descreve a ordem segura desde um repositório novo até o primeiro
ciclo comercial. Não habilite uma etapa posterior para compensar uma anterior
que ainda não foi validada.

## 1. Publicação e banco

1. Configure `NETLIFY_AUTH_TOKEN` e `NETLIFY_SITE_ID` como repository secrets.
2. Configure `CONTROL_PLANE_DATABASE_URL` no site Netlify e no environment
   GitHub `production`; os valores devem apontar para o banco exclusivo.
3. Execute `Migrations Control Plane` a partir de `main`, com backup recuperável
   ou, somente para banco comprovadamente vazio, modo de inicialização.
4. Faça merge em `main`. `Deploy Control Plane` executa testes, builds, publica
   com versão fixa do Netlify CLI e valida `/api/health` e `/api/ready`.
5. Um deploy que publicou mas falhou em `/api/ready` não está operacional.

As migrações nunca são aplicadas implicitamente pelo deploy.

## 2. Primeiro administrador

1. Integre o workflow `Bootstrap Operator`.
2. Cadastre no environment `production` os quatro secrets descritos em
   [BOOTSTRAP-OPERADOR.md](BOOTSTRAP-OPERADOR.md).
3. Execute a partir de `main`, informe `CRIAR_ADMIN`, marque a salvaguarda e
   aprove o environment.
4. Acesse `/login`, autentique e confirme `GET /api/auth/me`.
5. Remova os três secrets `CONTROL_PLANE_ADMIN_*` após a validação.

O painel de produção usa a mesma origem da API. Só configure
`CONTROL_PLANE_CORS_ORIGINS` se houver outro frontend autorizado; informe
origens HTTPS completas, separadas por vírgula e sem caminhos.

O bootstrap não promove operadores, não reativa contas e não cria um segundo
administrador.

## 3. Catálogo comercial

1. Como administrador, crie um plano para o produto correto.
2. Confira moeda, vigência, preço por bloco, mínimo por unidade e recursos.
3. Alterações futuras criam nova versão; nunca edite condições já contratadas.
4. Desativar um plano impede novas contratações, sem reescrever assinaturas.

## 4. Assinante e assinatura

1. Receba a solicitação do CTA com chave pública do produto; apenas testes que
   cumprem todos os critérios podem ser aprovados automaticamente.
2. Aprove (ou recuse com motivo) antes de converter a organização em `PROSPECT`.
3. A conversão cria o contato principal, mas não contrata nem provisiona.
4. Contrate uma versão vigente do mesmo produto em `TESTE` ou `ATIVA`.
5. A contratação registra o evento de provisionamento; com a flag desligada ele permanece na fila.
6. Confirme no detalhe que produto, condições negociadas e vencimento estão
   corretos.
7. Toda mudança deve aparecer na auditoria sanitizada.

## 5. Ambiente tenant

Com `PROVISIONAMENTO_REAL_HABILITADO=false`, a solicitação pode ser registrada,
mas o worker não cria recursos. Antes de habilitar provisionamento real:

1. valide Neon, AWS Secrets Manager, KMS opcional e prefixo de secrets;
2. publique e valide o provisionador isolado;
3. configure URL/token do provisionador;
4. confirme que connection strings passam somente pelo cofre/provisionador;
5. execute um tenant descartável e valide migrations, bootstrap e health;
6. somente então defina `PROVISIONAMENTO_REAL_HABILITADO=true` e agende/invoque
   o worker com segredo interno.

Ao finalizar, ambiente e assinante tornam-se ativos na mesma transação.

## 6. Diretório e concessão

Para um produto que já opera em banco compartilhado, vincule primeiro a
`tenantKey` existente pela tela do assinante. Esse vínculo cria um ambiente
`COMPARTILHADO` pendente, sem criar projeto ou banco. A contratação ativa o
ambiente e o registro no diretório na mesma transação, com um evento de
provisionamento já concluído para manter a trilha operacional.

Em testes sem domínio próprio, configure o destino exato da concessão:

```env
TENANT_PRODUCT_HOST_MAP={"sysbelt:academia-centro":"https://sysbeltfp.netlify.app"}
```

1. Configure uma credencial independente para cada produto em
   `CONTROL_PLANE_PRODUCT_CREDENTIALS`.
2. O tenant consulta o caminho multiproduto e respeita os TTLs do contrato.
3. Configure no tenant apenas a chave pública que valida concessões.
4. Envie uma concessão e confirme a revisão e a expiração de 24 horas.
5. Teste `ATIVO`, suspensão financeira e suspensão operacional.
6. No Psyché, confirme que suspensão financeira restringe administração sem
   bloquear funções clínicas.

O header legado do SysBelt deve permanecer desligado, salvo durante uma janela
de migração com data de encerramento definida.

## 7. Snapshot de uso

1. O tenant gera `eventoId` único e payload conforme o schema v1.
2. Assina `timestamp + "." + JSON canônico` com sua chave privada Ed25519.
3. Envia somente unidades e contagens agregadas.
4. O Control Plane valida ambiente ativo, chave pública e janela de cinco
   minutos; reenvio do mesmo evento é idempotente.
5. Financeiro confere snapshot e licenças antes de faturar.

## 8. Faturamento sem PSP

1. Gere o rascunho para a competência; sem snapshot válido nada é criado.
2. Revise itens, mínimo, blocos, preço congelado, descontos e acréscimos.
3. Emita a fatura (`RASCUNHO -> ABERTA`).
4. Enquanto o PSP estiver desligado, registre pagamento somente a partir de
   evidência externa confiável e referência única.
5. Marque vencidas em lotes, cancele somente estados permitidos e estorne sem
   reativação automática indevida.

## 9. Mercado Pago, depois

Esta etapa está deliberadamente adiada. Antes de ativá-la, siga
[OPERACAO-BILLING.md](OPERACAO-BILLING.md): credencial, webhook HTTPS,
simulador oficial, evidência no painel, worker manual, observação e somente
então scheduler. Mantenha as três flags de billing desligadas até lá.

## 10. Rotina operacional

- verificar deploy, `/api/health` e `/api/ready`;
- revisar dashboard, frota, filas falhas e auditoria;
- verificar backups e restauração, não apenas a existência do backup;
- aplicar migrações pelo workflow protegido;
- rotacionar credenciais por produto e ambiente;
- preservar logs sem payloads ou segredos;
- investigar itens `FALHOU` antes de reprocessar;
- nunca forçar estado diretamente no banco como procedimento normal.

## Critério de aceite do percurso

O Control Plane básico está operacional quando um administrador consegue fazer
login, criar plano/assinante/assinatura, consultar auditoria, e quando um tenant
de teste resolve o diretório, aceita uma concessão e envia um snapshot assinado
que produz uma fatura revisável. Provisionamento real e PSP possuem critérios
de aceite próprios e não são requisitos para esse primeiro percurso manual.
