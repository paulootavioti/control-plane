# Contrato Control Plane → Provisionador v1

O provisionador recebe `POST /v1/tenants/operacoes`, autenticado por Bearer
token interno e `x-idempotency-key`. O corpo contém somente operação,
`tenantKey` e `secretRef`; connection strings e credenciais são proibidas.

`APLICAR_MIGRATIONS` responde JSON com `schemaVersaoAtual`. Bootstrap e health
podem responder `204`. Retentativas com a mesma chave devem ser idempotentes.
Respostas de erro não podem incluir conteúdo recuperado do segredo.
