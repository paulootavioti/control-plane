# Contrato de billing v1

O Control Plane é a fonte de verdade comercial. O Mercado Pago é acessado
somente pelo adaptador `ProvedorPagamento`.

O checkout nasce `pending`. A preferência `PIX` ou `CARTAO` só se torna efetiva
após confirmação do PSP; disponibilidade de Pix recorrente deve ser homologada
na conta comercial definitiva antes do lançamento.

## Webhook

`POST /billing/webhooks/mercado-pago` valida `x-signature` e `x-request-id`,
limita o timestamp a cinco minutos e persiste o payload bruto antes de
processá-lo. A idempotência usa `{type}:{action}:{data.id}`. Reenvios retornam
`200`; novos eventos aceitos retornam `202`.

```json
{
  "id": 12345,
  "type": "subscription_preapproval",
  "action": "updated",
  "data": { "id": "2c938084..." }
}
```

Campos novos do PSP são armazenados, mas não produzem efeitos até serem
reconhecidos. A reconciliação consulta `/preapproval/{id}` e corrige
divergências. Retorno a `ATIVA` cancela passos pendentes de dunning.

Régua: D0 notifica; D+1, D+3 e D+7 reconciliam as retentativas do PSP e
notificam; D+10 suspende funções administrativas. O estado remoto é consultado
antes de nova cobrança para não duplicar retentativas automáticas.

`POST /billing/test/eventos` simula um evento sem chamar o PSP. Exige
`BILLING_TEST_EVENTS_ENABLED=true` e `x-control-plane-worker-secret`; deve ficar
desabilitado em produção.

O processamento assíncrono e a recuperação de leases estão documentados em
[`docs/OPERACAO-BILLING.md`](../../../docs/OPERACAO-BILLING.md).
