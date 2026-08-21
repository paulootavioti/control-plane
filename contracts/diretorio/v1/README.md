# Contrato de diretório v1

`GET /diretorio/v1/produtos/{produto}/tenants/{slug}`

Headers obrigatórios: `Authorization: Bearer <credencial do produto>` e
`x-control-plane-credential-version: v1`. Cada produto possui credenciais
próprias; uma credencial de `sysbelt` nunca autoriza `psyche` ou `mecanix`.

```json
{
  "schemaVersion": "1.0",
  "tenantKey": "64d729dc-8cbc-4fbf-9259-f28809faf55d",
  "produto": "psyche",
  "slug": "clinica-centro",
  "status": "SUSPENSO_FINANCEIRO",
  "acesso": {
    "administrativo": "RESTRITO_REGULARIZACAO",
    "clinico": "LIBERADO"
  },
  "secretRef": "arn:aws:secretsmanager:tenant",
  "tenantSchemaVersion": "2026.08.1",
  "credentialVersion": 2
}
```

Estados: `PENDENTE`, `ATIVO`, `SUSPENSO_FINANCEIRO`,
`SUSPENSO_OPERACIONAL` e `CANCELADO`. Somente `ATIVO` e os dois estados de
suspensão são resolvidos; os demais retornam `404 TENANT_NAO_ENCONTRADO`.

No Psyché, suspensão financeira restringe funções administrativas, mas mantém
o acesso clínico. O tenant plane aplica essa distinção nas rotas corretas.

Cache: `200` ativo por até 60 s; suspenso por até 15 s; `404` por até 5 s;
`401` e `5xx` não são armazenados. Em indisponibilidade, o tenant usa a última
concessão assinada ainda válida. Sem concessão válida, funções administrativas
falham fechadas, preservando a política clínica do Psyché.

## Compatibilidade SysBelt

`GET /diretorio/v1/tenants/{slug}` e `x-sysbelt-directory-secret` permanecem
temporariamente disponíveis com `CONTROL_PLANE_DIRECTORY_LEGACY_ENABLED=true`.
Respostas legadas incluem `Deprecation` e `Sunset`.
