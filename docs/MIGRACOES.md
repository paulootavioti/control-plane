# Migrações do Control Plane

As migrações de produção são aplicadas exclusivamente pelo workflow manual
`Migrations Control Plane`. O deploy da aplicação não altera o banco.

## Configuração inicial no GitHub

1. criar o environment `production`;
2. habilitar aprovação obrigatória para esse environment;
3. cadastrar nele o secret `CONTROL_PLANE_DATABASE_URL`;
4. limitar quais branches podem publicar no environment a `main`.

O secret deve apontar somente para o banco do Control Plane. Nunca use banco de
tenant, SysBelt, Mecanix ou Psyché.

## Execução

1. confirmar que o commit desejado já está em `main`;
2. gerar e verificar backup recuperável;
3. abrir Actions → Migrations Control Plane → Run workflow;
4. selecionar `main`, marcar a confirmação de backup e digitar `APLICAR`;
5. aprovar o environment `production`;
6. conferir `prisma migrate status` e o resumo do job.

O workflow serializa execuções, usa `prisma migrate deploy` e falha se a
confirmação, o backup declarado, o secret ou a URL PostgreSQL estiverem
ausentes. Também recusa qualquer referência diferente de `main`. Ele nunca
imprime a connection string.

## Rollback

Migrações aplicadas não são editadas nem removidas. Se uma mudança precisar ser
revertida, crie uma migração compensatória revisada e preserve os dados. Em
incidente de perda ou corrupção, interrompa o deploy e restaure o backup antes
de tentar uma nova migração.
