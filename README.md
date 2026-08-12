# SysBelt Control Plane

Aplicação independente que administra assinantes, planos, assinaturas,
provisionamento e a saúde comercial da plataforma B2B. Ela não armazena os
dados operacionais das academias.

## Fronteiras

- possui banco PostgreSQL e credenciais próprios;
- possui build e deploy Netlify próprios;
- não importa código da API do Tenant Plane;
- integra-se com cada academia somente por contratos versionados;
- nesta primeira etapa, expõe apenas `GET /api/health` no Netlify e
  `GET /health` durante o desenvolvimento local.

## Desenvolvimento local

Requer Node.js 20 ou superior.

```bash
cp .env.example .env
npm install
npm run dev
```

O schema comercial contém assinantes, contatos, planos versionados,
assinaturas e faturas com memória de cálculo por unidade. A URL registra a
fronteira exclusiva do banco; a rota de health check não abre conexão.

## Operador inicial

Depois de aplicar as migrations, defina as variáveis `CONTROL_PLANE_ADMIN_*`
e execute `npm run seed:operator` uma única vez. Não há usuário ou senha padrão.
O login usa `POST /api/auth/login` e a sessão pode ser consultada em
`GET /api/auth/me`.

## Netlify

Crie um site separado apontando o **base directory** para `control-plane`.
Configure `CONTROL_PLANE_DATABASE_URL` somente no ambiente desse site. O site
das academias não deve receber essa variável.
