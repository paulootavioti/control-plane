# Contrato Control Plane → Tenant v1

A concessão comunica somente o estado de acesso e os recursos contratados. O
Control Plane assina o JSON canônico sem o campo `assinatura` usando Ed25519;
o Tenant Plane valida com a chave pública da plataforma.

A concessão é vinculada ao `tenantKey`, possui revisão crescente e expiração.
O tenant falha fechado quando ela é inválida ou expirada.
