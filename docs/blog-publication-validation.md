# Correção da publicação — 03/11/2026

Correção disponível somente na [prévia do painel](https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev/admin/). O domínio institucional, o site principal na Vercel e a indexação não foram alterados.

## Comportamento entregue

- Selecionar a categoria principal inclui seu vínculo; categorias adicionais usam caixas de seleção. Abrir rascunhos antigos não salva nem corrige dados automaticamente.
- Pendências permanecem visíveis, abrem a aba e focam o campo. A capa é recomendada, não obrigatória.
- JSON-LD incompleto ou conflitante pode ser salvo como texto no rascunho. Publicação, atualização e agendamento exigem correção. A prévia privada avisa e omite o complemento inválido, preservando o conteúdo no editor.
- A validação editorial ocorre antes da mídia. Uma tentativa usa a mesma revisão salva; cliques repetidos e revisões concorrentes são protegidos, inclusive na transação do banco.
- API retorna código, campos e referência de diagnóstico: 422 para pendências, 409 para concorrência e 5xx para falhas de serviço. Os logs estruturados não recebem o texto do artigo ou credenciais.

## Evidências locais

- Build Cloudflare e Astro check concluídos, sem erros. Permanecem o aviso preexistente de tamanho do pacote administrativo e uma sugestão de async em teste antigo.
- PostgreSQL isolado: migrations, RLS, saves concorrentes, revisão pública imutável, publicação idempotente, redirecionamentos, agendamento e ensaio de migração aprovados.
- Worker compilado: nove grupos de integração aprovados; máximo de 33 chamadas de serviço por ação testada. Casos 422/409/500/502, mídia indisponível sem prontidão artificial, JSON-LD incompleto/duplicado e ausência de capa cobertos.
- Chromium e WebKit: rascunho legado inalterado ao abrir, vínculo da principal, foco, recarga de JSON-LD, dupla tentativa e outra aba salvando durante o preparo. Resumo de pendências conferido de 320 a 2560 px com texto a 100%/200%.

## Evidências na hospedagem

- 80 verificações reais do editor em Chromium/WebKit: H2/H3, índice, formatação, listas, citações, links, tabelas, imagens, persistência, metadados, revisões, atualização e ciclo editorial.
- 134 verificações de reflow de abas, formulários e diálogos a 100%/200%.
- API real: categoria ausente/inconsistente, JSON-LD incompleto/duplicado, bloqueio antes das imagens, referência do erro e prévia privada protegida.
- Imagem nova com 2936 px e imagem institucional existente publicadas por registros descartáveis. Originais continuam privados.
- Cron periódico real publicou o artigo agendado; relatório preservado em `artifacts/blog-publication/hosted-cron-real.json`. Uma execução posterior confirmou a versão final, o horário inválido e o gateway de agendamento; essa execução isoladamente não certifica a periodicidade.
- Dez páginas e 953 blocos de texto preservados integralmente. Regressão em nove rotas e 36 combinações responsivas sem violações de acessibilidade detectadas; menu, agendamento, FAQ e consentimento conferidos.
- Logs consultados exclusivamente no Worker Bicalho, filtrados pelo evento estruturado. Erros provocados pelos testes não são incidentes de clientes.

## Preservação e implantação

Os hashes dos dois rascunhos originais permaneceram idênticos. O artigo do cliente mantém 34 revisões. Sua imagem permanece pronta, com sete variantes; o original e as sete versões foram encontrados no armazenamento privado. Somente os registros e acessos criados pelos testes foram removidos.

Commit do produto: `09cabec` (inclui `2742ac6`). Worker: `584e0a37-c91b-4c8c-b912-046d6471c6c5`, servindo 100% do tráfego da prévia. A anotação da implantação confirma `Bicalho preview 09cabec`.

Home, Blog, painel e robots responderam 200 com `noindex, nofollow`; painel com `private, no-store`. SMTP e DNS não foram modificados nesta correção. Os testes hospedados usam serviços reais, mas as larguras e a ampliação são simuladas por navegador; não representam uma sessão em iPhone físico.

Relatórios detalhados ignorados pelo Git: `artifacts/blog-publication/`, `artifacts/blog-worker/`, `artifacts/blog-editor-live/`, `artifacts/blog-admin-resize/` e `artifacts/blog-live/`. Captura do aviso: `artifacts/blog-worker/pending-chromium-390.png`.
