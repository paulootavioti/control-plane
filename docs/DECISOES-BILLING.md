# Decisões de billing

## Provedor

O PSP escolhido é o Mercado Pago. A integração deve usar a API HTTP por meio de
`ProvedorPagamento`; regras comerciais não podem depender dos estados internos
do provedor. Credenciais serão configuradas somente após o lançamento e nunca
serão versionadas.

O adaptador cria assinaturas pendentes via `/preapproval`; cartão e Pix são
preferências de checkout, não uma promessa de que toda conta comercial terá a
mesma modalidade de recorrência habilitada. Antes de liberar Pix recorrente ao
público, o fluxo precisa ser homologado no sandbox e confirmado na conta
Mercado Pago definitiva. Até lá, nenhuma assinatura local é ativada apenas pela
criação do checkout: a ativação depende de evento assinado ou reconciliação.

Chamadas HTTP usam timeout de dez segundos e até três tentativas somente para
falhas de rede, `429` e `5xx`. Operações mutáveis carregam chave idempotente.
URLs da API e de retorno devem usar HTTPS, e mensagens do PSP não são copiadas
para erros internos ou respostas do Control Plane.

## Trial e inadimplência

- Trial: 14 dias.
- D0: marcar inadimplência e notificar.
- D+1, D+3 e D+7: retentar e notificar.
- D+10: suspender funções administrativas.
- Pagamento confirmado: reativar automaticamente.
- Suspensão e cancelamento nunca excluem dados.

O PSP pode executar retentativas próprias. Antes de solicitar uma nova cobrança,
o reconciliador deve consultar o PSP para impedir cobrança duplicada.

## Proteção especial do Psyché

O estado financeiro é separado da concessão de acesso. Para o produto `psyche`,
inadimplência, suspensão ou cancelamento restringem somente funções
administrativas/comerciais e o caminho de regularização permanece disponível.
O Control Plane nunca ordena bloqueio automático de prontuário, conteúdo
terapêutico ou comunicação entre paciente e profissional.

Esta regra é um requisito de produto conservador para dados de saúde; não é uma
interpretação jurídica definitiva. Retenção e exclusão exigem validação jurídica
e profissional específica antes de serem automatizadas.

Referências oficiais para a futura revisão jurídica:

- [LGPD — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Perguntas frequentes da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes)
