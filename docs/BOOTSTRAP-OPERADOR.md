# Bootstrap do operador inicial

O primeiro administrador é criado exclusivamente pelo workflow manual
`Bootstrap Operator`, protegido pelo environment `production`. Antes da
execução, cadastre nesse environment:

- `CONTROL_PLANE_DATABASE_URL`;
- `CONTROL_PLANE_ADMIN_NAME`;
- `CONTROL_PLANE_ADMIN_EMAIL`;
- `CONTROL_PLANE_ADMIN_PASSWORD` com pelo menos 12 caracteres.

Execute o workflow a partir de `main`, informe `CRIAR_ADMIN`, marque a
salvaguarda e aprove o deployment do environment. Os valores nunca são
impressos no log.

A operação é idempotente somente quando o mesmo e-mail já pertence a um
administrador ativo. Ela falha sem modificar dados se o e-mail pertencer a
outro perfil, se o operador estiver inativo ou se já existir outro
administrador. Depois do bootstrap, novos operadores devem ser criados pelo
painel/API e os secrets `CONTROL_PLANE_ADMIN_*` podem ser removidos.
