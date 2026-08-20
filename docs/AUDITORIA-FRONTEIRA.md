# Auditoria da fronteira Control Plane ↔ SysBelt

Auditoria executada sobre `SysBeltFP/main` antes da extração.

## Resultado

Não há import do Tenant Plane em `control-plane/` nem import do Control Plane no código do Tenant Plane. O serviço já possui pacote Node, configuração Prisma, migrations, banco, API, painel e configuração Netlify próprios.

## Dependências encontradas

| Fronteira | Evidência | Tratamento |
|---|---|---|
| CI | `.github/workflows/ci.yml` executava API e painel pelo prefixo `control-plane/` | Criar CI próprio neste repositório e remover os jobs correspondentes no SysBelt |
| Deploy | `.github/workflows/deploy-control-plane.yml` publicava pelo monorepo | Criar workflow próprio; manter o workflow antigo apenas até validar o novo caminho |
| Contratos | `contracts/control-plane-provisioner`, `contracts/control-plane-tenant` e `contracts/tenant-control-plane` ficam na raiz do SysBelt | Preservar cópia versionada nos dois repositórios durante a transição |
| Configuração | `.gitignore` do SysBelt ignora artefatos sob `control-plane/` | Criar `.gitignore` próprio e retirar regras obsoletas do SysBelt |
| Ambiente | Control Plane usa exclusivamente variáveis `CONTROL_PLANE_*`, `NEON_*`, `AWS_*` e `TENANT_PROVISIONER_*` | Migrar valores no provedor sem expô-los em Git |
| Integração | SysBelt usa `CONTROL_PLANE_URL` e a chave pública de concessões | Permanecem no Tenant Plane; mudar URL somente no corte |
| Documentação | README e documentos do SysBelt descrevem o diretório interno | Atualizar para apontar ao repositório independente |

## Conclusão

O acoplamento encontrado é operacional e documental, não de código. A extração por histórico filtrado pode prosseguir sem alterar contratos HTTP nem dados de produção.
