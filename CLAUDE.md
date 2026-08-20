# Padrões — Control Plane

## Fronteiras

- Este serviço administra produtos, assinantes, planos, cobrança e o diretório de tenants.
- Dados operacionais dos tenants não pertencem a este banco.
- Integrações com tenant planes usam contratos versionados em `contracts/`.
- Credenciais de bancos de tenants nunca são persistidas; somente referências ao cofre.

## Segurança e identidade

- Operadores possuem identidade e sessão próprias; nunca reutilizar usuários de um tenant plane.
- Senhas precisam de hash forte, salt individual e comparação em tempo constante.
- Tokens, credenciais e segredos nunca aparecem em resposta, auditoria ou log.
- Endpoints de credencial exigem rate limit distribuído antes de produção multi-instância.

## Dados e migrações

- Nunca editar migração aplicada; criar uma nova migração.
- Mudanças comerciais são auditadas na mesma transação da alteração.
- Webhooks e comandos externos devem ser idempotentes e reconciliáveis.
- Adapters de PSP, fiscal, cofre e provisionamento ficam atrás de interfaces testáveis.

## Definição de pronto

- CI verde para typecheck, testes, lint aplicável e build.
- Comportamento novo coberto por testes, incluindo isolamento entre produtos quando aplicável.
- `.env.example` contém apenas placeholders.
- Nenhum segredo, credencial, dump, banco local ou artefato gerado é versionado.
