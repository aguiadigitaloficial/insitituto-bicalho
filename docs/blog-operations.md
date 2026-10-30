# Blog editorial — prévia Cloudflare e Supabase

A branch `codex/cloudflare-blog` prepara um Worker exclusivo em conta do Instituto. A Vercel, o domínio institucional, a branch principal e sua indexação permanecem fora desta publicação.

## Ambiente e acesso

1. Usar somente o projeto Supabase isolado do Instituto. Conferir organização, proprietário e plano Free antes de aplicar as três migrations em ordem. A conta da plataforma é separada dos usuários convidados do blog.
2. No Auth, desativar cadastro público e acesso anônimo; preservar confirmação de e-mail. Definir Site URL como a origem exata da prévia e permitir seus callbacks e `/admin/?password=1`, incluindo equivalentes locais quando necessários.
3. Convidar o proprietário editorial e cadastrar seu UUID em `blog_members` com role `owner`. Somente o proprietário administra convites; autores públicos são cadastros separados. Nunca versionar ou enviar senhas e chaves em mensagens.
4. Guardar credenciais de provisionamento em `.env.provision.local` e as variáveis do aplicativo em `.env.blog.local`, ambos ignorados. O runtime recebe `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `BLOG_CRON_SECRET` pelo mecanismo de secrets do Worker. A chave de serviço nunca usa prefixo PUBLIC.
5. A prévia exige `BLOG_HOST=cloudflare`, `BLOG_ENVIRONMENT=preview`, `BLOG_DEMO=true` e `PUBLIC_INDEXABLE=false`. As páginas anteriores continuam estáticas; blog, painel, API e sitemap são renderizados pelo Worker.
6. Conferir entrega de convite e recuperação em uma caixa real. O envio padrão do Supabase pode limitar destinatários a membros da organização e possui cotas baixas; SMTP próprio é necessário para liberar convites externos. Uma resposta aceita pela API não comprova entrega.

O callback entende os templates com `token_hash` e os fragmentos de sessão dos templates padrão; valida os tokens no próprio servidor e remove-os do endereço. Links privados e painel têm `private, no-store` e noindex.

## Build e publicação isolada

Usar Node 24. O build padrão mantém a configuração Vercel; `npm run build:cloudflare` produz `dist-cloudflare/` separadamente. O comando de publicação verifica conta explícita do Instituto, token de conta ativo, branch `codex/`, nome exato do Worker, ausência de rotas/domínios adicionais, noindex e pacote sem credenciais incorporadas. Não utiliza o login global da agência.

```powershell
npm run build:cloudflare
node --env-file=.env.provision.local --env-file=.env.blog.local scripts/deploy-cloudflare-preview.mjs
npm run deploy:cloudflare:preview
```

O segundo comando apenas verifica; o terceiro publica o Worker de prévia e seus secrets de forma conjunta. O arquivo JSON temporário de secrets fica dentro de `artifacts/`, ignorado. Relacionar implantação e commit e conferir a URL pública antes da entrega. Não habilitar domínio próprio, indexação ou plano pago automaticamente.

## Mídia, demonstrações e agendamento

Cloudflare Images prepara WebP/AVIF sem ampliar os originais; EXIF/XMP de direitos autorais são reanexados sem GPS. Originais e rascunhos ficam no bucket privado. Antes de publicar/agendar, o painel prepara uma imagem por requisição; isso evita exceder as chamadas externas do Workers Free. O SQL valida revisão e snapshot da mídia sob bloqueio. Uma edição só aparece publicamente ao clicar em Atualizar.

WebP mantém a resolução original até 2936 px. AVIF é opcional dentro do limite de 1200 px por eixo do serviço; respostas alternativas em WebP/JPEG não são gravadas como AVIF. Quando o conjunto AVIF fica incompleto, a página usa o conjunto WebP completo para preservar a nitidez em telas de alta densidade. Editar apenas alt text, legenda ou crédito não reprocessa os arquivos; mudar os direitos autorais exige preparar novamente a imagem.

O seed exige projeto isolado, `BLOG_DEMO=true` e `BLOG_SEED_ACTOR` com o UUID do proprietário:

```powershell
node --env-file=.env.blog.local --import tsx scripts/blog-seed.ts
```

São 12 demonstrações neutras com fotos institucionais existentes, sem orientações clínicas. O seed é idempotente por slug. Demonstrações não entram no sitemap e são bloqueadas em produção.

Implantar `publish-scheduled` com `verify_jwt=false`, protegido por `BLOG_CRON_SECRET`. Configurar `BLOG_APP_ORIGIN` com a origem da prévia. Adicionar `blog_edge_url` e `blog_cron_secret` ao Vault e executar `supabase/cron.sql` uma vez. Conferir `cron.job_run_details`, respostas de `pg_net` e `blog_schedules.last_error`. O Cron executa a cada minuto; erros mantêm o agendamento pendente. Reagendar seleciona explicitamente uma revisão nova.

## Validação e migração

- `test:blog:core`: PostgreSQL isolado, migrations, RLS, concorrência, revisão pública imutável, aliases, lixeira, agendamento, sanitização e ensaio de migração.
- `test:blog:images`: imagens, orientação, metadados e preservação dos pixels. `test:blog:worker`: Worker compilado com Auth/Storage/PostgREST simulados e PostgreSQL real; não certifica serviços hospedados.
- `test:blog:browser`: Chromium/WebKit, leitura sem JavaScript, acessibilidade e apresentação. Definir `BLOG_TEST_TARGET=cloudflare` para o runtime Cloudflare e `BLOG_RUN_LEGACY=true` para executar também a suíte anterior.
- `scripts/blog-live-check.ts`: exige `BLOG_TEST_PROJECT_REF`, `BLOG_INTEGRATION_CONFIRMED=true`, secrets e `BLOG_TEST_BASE` apontando exclusivamente à prévia aprovada. Verifica serviços reais e remove somente seus próprios UUIDs descartáveis. Usar `--wait-cron` para certificar o agendamento externo e `--full-image` para testar o upload com 2936 px, a edição de metadados e o conjunto responsivo completo. Conferir entrega de e-mail adicionalmente na caixa real.

Para migrar no futuro, criar destino vazio, aplicar as três migrations e exportar/importar com `scripts/blog-transfer.ts`. Excluir demonstrações e acessos de teste; preservar IDs de mídia, slugs, revisões, arquivos e copyright. Recriar convites e SMTP, URLs, secrets e Cron; conferir contagens e hashes antes de trocar a origem ativa. Pausar o publicador anterior durante a troca para evitar duplicação. Manter o ambiente anterior disponível para retorno até a aprovação.

Retirar um artigo oculta sua página, mas não revoga cópias de imagens públicas já compartilhadas. Alterações de imagem geram caminhos novos; originais continuam privados.
