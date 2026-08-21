# Operação do billing

## Worker

`billing-background` executa, nesta ordem:

1. eventos brutos de webhook ainda não processados;
2. passos vencidos da régua de dunning;
3. reconciliação de assinaturas vinculadas ao Mercado Pago.

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

## Notificações

Notificações são gravadas em `NotificacaoBilling` com chave idempotente. Nesta
etapa a outbox é persistente, mas não existe transporte real de e-mail/SMS. A
integração futura deve consumir apenas registros `PENDENTE`, registrar tentativas
e nunca incluir prontuário ou qualquer dado clínico na mensagem.

## Habilitação

Antes de definir `BILLING_WORKER_ENABLED=true`:

1. aplicar migrações e validar backup;
2. configurar token e webhook secret do Mercado Pago;
3. cadastrar o webhook HTTPS no PSP;
4. realizar evento de teste e confirmar persistência/reconciliação;
5. configurar o agendador com o segredo interno;
6. observar a fila e os logs antes de liberar assinaturas reais.
