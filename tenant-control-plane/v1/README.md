# Contrato Tenant → Control Plane v1

O arquivo `contagem-alunos.schema.json` é o contrato canônico do snapshot
agregado usado para licenciamento e faturamento.

Ele permite somente identidade técnica e nome da unidade, estado e quantidade
de alunos ativos. Nomes, documentos, contatos ou identificadores de alunos são
proibidos. `eventoId` torna o recebimento idempotente e `tenantKey` vincula o
payload ao ambiente autenticado.

Mudanças incompatíveis exigem um novo diretório de versão; este schema não
deve ser alterado depois de haver consumidores em produção.

## Assinatura

O tenant envia `x-sysbelt-timestamp` em ISO 8601 e `x-sysbelt-signature` em
base64. A assinatura Ed25519 cobre `timestamp + "." + JSON canônico do payload`.
O Control Plane aceita uma diferença máxima de cinco minutos e valida com a
chave pública registrada no ambiente. A chave privada nunca sai do tenant.
