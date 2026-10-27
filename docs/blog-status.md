# Estado da implementação — 27/10/2026

Branch local: `codex/blog-editorial`. O endereço principal permanece ligado à `main`, commit `a3c099e7d8900f695e56ef9938c52393183662b3`. Não houve alteração do domínio nem liberação de indexação.

## Implementado no código

- Blog público e arquivos de categoria, tag e autor; busca, destaques, paginação, artigo em HTML, índice, relacionados e agendamento existente.
- Painel Tiptap com conteúdo, mídia, categorias/tags/autores, SEO, redes sociais, JSON-LD e metatags controladas.
- Autenticação por convite, autorização de proprietário/editor, RLS, rascunhos, salvamento concorrente, revisões, publicação separada, retirada/lixeira/restauração e agendamento.
- Upload privado assinado, otimização com Sharp, formatos responsivos e direitos autorais; metadados de mídia publicados em snapshot.
- Cron/Edge Function com autenticação independente e publicador compartilhado; publicação SQL idempotente e cancelamento verificado sob bloqueio de linha.
- Migrations, seed de 12 demonstrações neutras e ferramentas de exportação/importação/conferência. Originais, relatórios e segredos ficam fora do Git.

## Validação executada localmente

- Build Astro/Vercel aprovado; páginas anteriores continuam estáticas.
- Migrations em PostgreSQL isolado, RLS, concorrência, publicação imutável, redirecionamentos, estados editoriais e validação de JSON-LD/XSS.
- Ensaio de migração para um segundo PostgreSQL limpo, com slugs/revisões preservados e demonstrações/acessos de teste excluídos.
- Matriz de 130 cenários de interface Chromium/WebKit, entre 320 e 2560 px; texto ampliado, movimento normal/reduzido e HTML sem JavaScript. Rechecagem adicional das abas editoriais com Axe e 432 seleções de fotografia em 2×/3×.
- Suíte existente aprovada: navegação, atendimento, consentimento, animações, CTA, painéis mobile, 230 casos responsivos, SEO de dez páginas e 194 arquivos com metadados, 192 casos de qualidade das fotos, 536 verificações tipográficas e 953 blocos de texto preservados. Somente os links previstos de Blog foram acrescentados.
- Auditoria de dependências de produção sem vulnerabilidades no momento da execução.

Os testes visuais usam fixtures locais explícitas; não representam uma conexão com Supabase hospedado. A interface de teste não cria um acesso alternativo no código da aplicação.

## Dependência externa pendente

A conta Supabase da agência ainda não está conectada a esta tarefa. Não há projeto remoto de teste, chaves, proprietário convidado nem configuração de SMTP/Cron disponíveis neste ambiente. Foi solicitada a conexão e a organização da agência ao usuário.

Depois da conexão: provisionar exclusivamente o projeto de teste, aplicar as migrations, desabilitar cadastro público, configurar Auth/SMTP/URLs, convidar proprietário, preparar mídia/demonstrações, configurar Edge/Vault/Cron, executar a integração hospedada (incluindo entrega de e-mails) e publicar a Vercel Preview da branch no projeto existente. Não promover para produção.

A prévia funcional hospedada ainda não foi entregue. O site principal não recebeu estas mudanças. Consultar `blog-operations.md` para os procedimentos e os requisitos da migração futura.
