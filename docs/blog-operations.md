# Blog editorial — ambiente de teste

Branch: `codex/blog-editorial`. Usar Preview no projeto Vercel existente. Não promover para produção nesta etapa.

## Conexão

1. Criar projeto Supabase exclusivo da agência em plano gratuito disponível. Não reutilizar banco de outro cliente. Aplicar as migrations em ordem, com o histórico de migrations do Supabase.
2. No Auth, desativar cadastro público; manter login por e-mail/senha. Cadastrar as URLs exatas da prévia e `http://127.0.0.1:4322` em Redirect URLs (callback e `/admin/?password=1`). O domínio de autenticação é a prévia, não `PUBLIC_SITE_URL`.
3. Convidar o primeiro proprietário pelo Supabase e inserir o UUID em `blog_members` com role `owner`. Os demais convites serão geridos no painel. Nunca versionar senhas ou chaves.
4. Configurar no escopo Preview da branch: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BLOG_CRON_SECRET`, `BLOG_DEMO=true`, `PUBLIC_INDEXABLE=false`. A chave de serviço é exclusivamente do servidor. Não usar prefixo PUBLIC para essas chaves.
5. Configurar SMTP antes de convidar endereços externos à equipe. O envio padrão do Supabase tem limites e pode atender apenas os membros da organização. Conferir convite e recuperação em uma caixa real. Não declarar entrega de e-mail apenas porque a API aceitou a solicitação.
6. Templates de convite/recuperação podem usar `{{ .SiteURL }}/api/blog/callback/?token_hash={{ .TokenHash }}&type=invite&next=password` (ou `type=recovery`). Definir Site URL para a prévia. O painel também trata tokens da sessão recebidos no fragmento do convite padrão, enviando-os somente ao próprio servidor para validação e removendo-os da barra de endereço.

## Agendamento

Implantar `publish-scheduled` com a configuração de `supabase/config.toml`. A função exige o segredo independente `BLOG_CRON_SECRET`. Definir nela `BLOG_APP_ORIGIN` para a URL estável da branch Preview. Se houver proteção de implantação, configurar também o bypass de automação específico da Vercel; não desativar a proteção global do projeto.

Adicionar no Vault `blog_edge_url` e `blog_cron_secret`, então executar `supabase/cron.sql` uma vez. Conferir `cron.job_run_details`, respostas do `pg_net` e `blog_schedules.last_error`. O Cron chama a função a cada minuto; falhas preservam o job pendente. Publicação manual e agendada usam `publishRevision` no servidor, com a mesma validação e operação SQL idempotente. Edições depois do agendamento não substituem silenciosamente a revisão agendada: reagendar para selecionar a nova revisão.

## Demonstrações

Executar com Node 24 e variáveis privadas carregadas de arquivo ignorado:

```powershell
node --env-file=.env.blog.local --import tsx scripts/blog-seed.ts
```

Definir `BLOG_SEED_ACTOR` como UUID do proprietário de teste. O seed é idempotente por slug; gera 12 publicações explicitamente demonstrativas a partir do acervo institucional existente. Não há orientação clínica. Produção filtra demonstrações mesmo se `BLOG_DEMO` estiver habilitado por engano. O sitemap também as exclui.

## Validação

`npm run test:blog:core` executa as migrations em PostgreSQL isolado (PGlite) e confere RLS, transações, concorrência, publicação, redirecionamentos e sanitização. Isso não substitui a verificação do Supabase hospedado, Auth, Storage, SMTP e Cron reais. `npm run test:blog:browser` verifica a interface com dados de demonstração locais isolados; suas simulações são identificadas no relatório.

O teste de integração hospedada fica em `scripts/blog-live-check.ts`. Requer o projeto exclusivo confirmado por `BLOG_TEST_PROJECT_REF`, `BLOG_INTEGRATION_CONFIRMED=true`, as chaves privadas, `BLOG_CRON_SECRET` e `BLOG_TEST_BASE` apontando para a Vercel Preview. Cria contas descartáveis de proprietário/editor, exercita os fluxos reais e remove somente os UUIDs criados pela própria execução. Usar `--wait-cron` para conferir o agendamento externo, além do publicador. Sem essa opção, o teste força o horário somente do próprio job e testa o gateway; não certifica o Cron externo. Convites e recuperação via SMTP exigem conferência adicional da entrega em uma caixa real.

Para a prévia local completa, usar `npm run dev` ou `npm run preview` com as variáveis privadas do projeto de teste. O antigo servidor estático isolado não executa as novas rotas SSR.

Executar a suíte existente contra a prévia estática e os testes do blog contra Astro SSR. Confirmar as respostas de visitante sem JavaScript e as políticas RLS no projeto real, usando a chave anônima e um editor convidado. Conferir o commit da Vercel Preview, noindex, fluxo de publicação e o horário de São Paulo antes de entregar como funcional.

## Migração ensaiável e retorno

1. Criar novo projeto na conta do cliente, aplicar as migrations, e remover somente os registros iniciais de taxonomias no projeto destino vazio antes da importação. Não mudar URLs do ambiente anterior.
2. Pausar o job de agendamento durante a janela, exportar com as chaves do projeto de origem: `node --env-file=.env.source.local --import tsx scripts/blog-transfer.ts export artifacts/blog-transfer`. O pacote contém dados privados e deve permanecer fora do Git. Ele exclui demonstrações e contas de teste; zera referências a usuários de acesso. Autores públicos, IDs, slugs, revisões, originais, variantes e direitos autorais permanecem.
3. Ensaiar em destino descartável vazio. Carregar as chaves do destino e `BLOG_IMPORT_CONFIRMED=true`; executar `import` e depois `verify`. Conferir contagens, campos e hashes. Não sobrescrever banco com dados existentes. Em erro, manter origem como ambiente ativo, corrigir/limpar apenas o destino de ensaio e repetir.
4. Recriar acessos por convite (não migrar senhas), configurar SMTP, Redirect URLs, Vault, Edge Function e Cron no cliente. Fazer testes de convite, recuperação, publicação, upload e horário. Atualizar as variáveis da branch Preview para validar o destino antes de qualquer alteração de domínio.
5. Somente após autorização posterior: definir o destino definitivo, domínio e indexação. Manter backup e origem sem alterações durante a janela de conferência. Retorno: restaurar as variáveis do ambiente anterior e reativar apenas o Cron da origem, evitando dois publicadores simultâneos. Nada neste recurso altera indexação ou domínio automaticamente.

As imagens publicadas são arquivos públicos. Retirar um artigo oculta sua página; não revoga cópias de imagens já compartilhadas. Originais continuam privados. Alterações em imagens geram caminhos novos para evitar cache de versões anteriores.
