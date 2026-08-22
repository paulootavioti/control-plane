# Operação do billing

## Worker

`billing-background` executa, nesta ordem:

1. eventos brutos de webhook ainda não processados;
2. passos vencidos da régua de dunning;
3. reconciliação de assinaturas vinculadas ao Mercado Pago.
4. entrega da outbox de notificações, quando explicitamente habilitada.

A função exige `x-control-plane-worker-secret`, permanece desabilitada com
`BILLING_WORKER_ENABLED=false` e processa no máximo
`BILLING_WORKER_BATCH_SIZE` itens de cada fila por chamada.

O agendador externo deve chamar:

```text
POST /.netlify/functions/billing-background
x-control-plane-worker-secret: <segredo interno>
```

Cadência inicial recomendada: a cada 15 minutos. A configuração do agendador e
do segredo é manual e só deve ocorrer depois da homologação do Mercado Pago.

## Garantias de processamento

- webhook é persistido antes de responder ao PSP;
- evento possui chave idempotente e até cinco tentativas automáticas;
- evento ou passo capturado recebe lease de 15 minutos;
- se uma execução serverless morrer, o lease expirado permite retomada;
- o worker reconcilia o PSP antes de suspender;
- reativação cancela passos pendentes e reabre somente o produto correspondente;
- suspensão financeira do Psyché mantém a concessão clínica liberada.

## Observabilidade e retomada manual

Operadores `FINANCEIRO` e `ADMIN_PLATAFORMA` podem consultar contagens e a
antiguidade das filas sem receber payloads, destinatários ou dados pessoais:

```text
GET /billing/operacao/resumo
GET /billing/operacao/falhas?limite=20
GET /billing/operacao/execucoes?limite=20
GET /billing/operacao/prontidao
```

Itens definitivamente falhos podem ser devolvidos à fila de forma atômica. A
operação é auditada e uma segunda tentativa concorrente não duplica a retomada:

```text
POST /billing/operacao/webhooks/:eventoId/reprocessar
POST /billing/operacao/dunning/:tentativaId/reprocessar
POST /billing/operacao/notificacoes/:notificacaoId/reprocessar
```

Somente itens em `FALHOU` são elegíveis. Respostas `409` indicam que o item já
mudou de estado e não deve ser forçado. A retomada não executa o item dentro da
requisição; o worker continua responsável pelo processamento assíncrono.
O painel apresenta essas informações na rota `/billing`, disponível somente
para os mesmos perfis autorizados pela API.
Cada chamada autenticada do worker registra início, conclusão, contadores e
resultado (`SUCESSO`, `PARCIAL` ou `FALHOU`). O histórico não contém payloads,
destinatários ou segredos.
O diagnóstico de prontidão retorna apenas booleanos. Ele nunca devolve tokens,
segredos ou URLs configuradas e diferencia preparação para homologação de
habilitação efetiva em produção.
Ao retomar dunning, a assinatura precisa continuar elegível. A ação apenas
reagenda o passo; antes de executá-lo, o worker reconcilia novamente o PSP.

## Notificações

Notificações são gravadas em `NotificacaoBilling` com chave idempotente. Nesta
etapa a outbox é persistente, mas não existe transporte real de e-mail/SMS. A
integração futura deve consumir apenas registros `PENDENTE`, registrar tentativas
e nunca incluir prontuário ou qualquer dado clínico na mensagem.

O consumidor HTTP usa lease de 15 minutos, chave de idempotência, cinco
tentativas e backoff. Ele só é criado com
`BILLING_NOTIFICATION_DELIVERY_ENABLED=true`, URL HTTPS e token exclusivo.
O receptor deve transformar o evento no canal escolhido (e-mail/SMS/WhatsApp)
e respeitar a chave enviada em `idempotency-key`. Até a homologação do receptor,
a flag deve permanecer `false`.

## Habilitação

Antes de definir `BILLING_WORKER_ENABLED=true`:

1. aplicar migrações e validar backup;
2. configurar token e webhook secret do Mercado Pago;
3. cadastrar o webhook HTTPS no PSP;
4. realizar evento de teste e confirmar persistência/reconciliação;
5. configurar o agendador com o segredo interno;
6. observar a fila e os logs antes de liberar assinaturas reais.
