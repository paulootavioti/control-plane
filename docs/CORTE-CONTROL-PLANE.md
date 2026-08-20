# Corte do Control Plane

## Ordem de execução

1. Publicar a branch extraída e validar o CI sem alterar produção.
2. Cadastrar `NETLIFY_AUTH_TOKEN` e `NETLIFY_SITE_ID` como GitHub Actions Secrets no novo repositório.
3. Manter o site Netlify atual e associá-lo ao novo repositório com base directory vazio (raiz).
4. Replicar no site, sem registrar valores em Git, todas as variáveis listadas em `.env.example`.
5. Aplicar `npm run prisma:migrate:deploy` contra o banco existente antes do primeiro deploy que exigir migration nova.
6. Executar o deploy manual pelo workflow do repositório independente.
7. Validar `/api/health`, login do operador, diretório de tenant, emissão de concessão e recebimento de snapshot.
8. Observar logs e métricas por um ciclo operacional antes de mesclar a remoção no SysBelt.
9. No SysBelt, manter `CONTROL_PLANE_URL` apontando para a mesma origem; nenhuma mudança de DNS é necessária se o site existente for reaproveitado.
10. Desabilitar o workflow antigo somente após um deploy bem-sucedido pelo novo repositório.

## Ponto de não-retorno

A extração de código não cria ponto de não-retorno. O primeiro ponto sensível é aplicar uma migration incompatível com a versão anterior. Nesta etapa A0 não há migration nova. Não excluir banco, site, segredos ou histórico do Netlify durante o corte.

## Rollback

1. Reassociar o site Netlify ao repositório SysBelt e restaurar base directory `control-plane`.
2. Executar o workflow legado de deploy pelo commit anterior do SysBelt.
3. Preservar o mesmo banco e as mesmas variáveis; não restaurar dump se nenhuma migration destrutiva foi aplicada.
4. Manter o novo repositório disponível para diagnóstico, sem forçar push ou apagar histórico.

## Render e provisionador

Se o provisionador isolado estiver no Render, não é necessário mover o serviço nesta etapa. Confirmar apenas que `TENANT_PROVISIONER_URL` e `TENANT_PROVISIONER_TOKEN` do Netlify continuam apontando para ele e que sua allowlist não depende do repositório de origem.
