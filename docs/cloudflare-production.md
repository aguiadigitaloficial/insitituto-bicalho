# Candidato na conta do domínio

O Worker `insitituto-bicalho`, da conta `3799fcca9a44fc397332387e593b9cc5`, foi criado pelo responsável pelo domínio. Seu primeiro build (2026-11-09, versão `fe2815e5-8c3b-46cf-b7bb-e608081fc414`) usou a branch `main`, com o site estático antigo. Blog e painel retornaram 404. O domínio oficial ainda servia o site anterior na conferência HTTP.

Esta configuração prepara a versão atual, incluindo SSR do blog, para o mesmo Worker. Não associa o domínio, não altera DNS e não habilita indexação. O Worker antigo de prévia e a configuração Vercel permanecem separados.

## Configuração do Workers Builds

Em **Workers e Pages → insitituto-bicalho → Settings → Build**, usar:

| Campo | Valor |
| --- | --- |
| Repositório | `aguiadigitaloficial/insitituto-bicalho` |
| Branch de produção | `codex/cloudflare-production` (após envio ao GitHub) |
| Diretório raiz | raiz do repositório |
| Comando de build | `npm run build:cloudflare:production` |
| Comando de deploy | `npm run deploy:cloudflare:production` |
| Builds de preview de outras branches | desativados neste Worker |
| Node | 24, conforme `.nvmrc` e `package.json` |

Os comandos usam `wrangler.production.jsonc` e `dist-cloudflare-production/server/wrangler.json` explicitamente. Não usar apenas `npx wrangler deploy`, pois o arquivo padrão pertence à prévia em outra conta. Não mesclar a branch em `main` durante esta preparação.

O token gerado pelo Workers Builds deve conseguir consultar e atualizar este Worker nesta conta. O publicador valida conta, nome, branch, pacote, rotas dinâmicas e `noindex` antes de executar Wrangler. As chaves do banco não fazem parte do Git nem do ambiente de compilação.

## Antes do primeiro deploy do candidato

Em **Settings → Variables & Secrets**, cadastrar como segredos de execução:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOG_CRON_SECRET`

Usar o projeto Supabase confirmado para a publicação definitiva. A chave de serviço é privada; não colocar em variável `PUBLIC_`, no chat ou no repositório. O guard consulta apenas os nomes dos segredos e bloqueia o deploy se faltar algum. Essa verificação não prova que os valores estão corretos: login, publicação, imagens e agendamento ainda precisam de testes reais.

Dois Workers com o mesmo Supabase compartilham os mesmos artigos, usuários e alterações. Antes de habilitar edição no candidato, definir a promoção do banco atual ou a migração para outro projeto, com cópia de segurança. Não criar um segundo agendador apontando para o mesmo banco. Rever Supabase Auth Site URL, URLs de retorno para convites/recuperação e o destino do Cron; SMTP deve continuar pertencendo ao Instituto.

## Sequência para conectar o domínio

1. Validar o candidato em `https://insitituto-bicalho.cbicalhogarcia.workers.dev`: páginas, blog, painel, imagens, formulários, login, publicação e e-mails. Ainda ficará com `noindex` e sem demonstrações públicas.
2. Conferir o backup DNS, serviços existentes e redirecionamentos antigos. O export de 2026-11-09 mostra apex em `target.rockfunnels.com`, `www` apontando para o apex, MX da Titan e subdomínios independentes. `cpanel` e `ftp` também apontam para o apex e exigem revisão antes da troca. Preservar os registros de e-mail e subdomínios não envolvidos.
3. Preparar a mudança de produção em separado: configuração dos Custom Domains, escolha de endereço canônico e redirecionamento do outro hostname, SSL, indexação e sitemap. O guard deste candidato não permite essa mudança implicitamente.
4. Realizar a troca somente depois dos testes e da confirmação do responsável; verificar domínio com e sem `www`, HTTPS, blog, painel, links de recuperação, robots e canonical.
5. Registrar versão/commit e plano de retorno. Manter a prévia bloqueada para indexação; não liberar demonstrações nem rascunhos.

## Verificação local

`npm run test:cloudflare:production` testa os bloqueios da configuração.

`npm run build:cloudflare:production` executa Astro Check, compila, compara a fonte antes/depois e grava a impressão digital do pacote em `artifacts/provision/cloudflare-production-build.json`.

`npm run check:cloudflare:production` verifica o pacote sem publicar. Os comandos de validação não modificam banco, domínio ou DNS.
