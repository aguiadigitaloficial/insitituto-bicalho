# Produção na conta do domínio

Em 2026-11-10, após a conexão e validação de `https://institutobicalho.com`, foi autorizada a indexação das páginas públicas no domínio oficial. A configuração agora usa `PUBLIC_INDEXABLE=true`, com proteção por hostname: o endereço `workers.dev` continua enviando `noindex`, tanto para arquivos estáticos quanto para respostas SSR. Painel, prévias privadas, busca, tags, demonstrações e 404 continuam bloqueados. A prévia na outra conta não é alterada.

O Worker `insitituto-bicalho`, da conta `3799fcca9a44fc397332387e593b9cc5`, foi criado pelo responsável pelo domínio. Seu primeiro build (2026-11-09, versão `fe2815e5-8c3b-46cf-b7bb-e608081fc414`) usou a branch `main`, com o site estático antigo. Blog e painel retornaram 404. O domínio oficial ainda servia o site anterior na conferência HTTP.

Esta configuração publica a versão atual, incluindo SSR do blog, no mesmo Worker. O publicador não altera DNS nem associa domínios. O Worker antigo de prévia e a configuração Vercel permanecem separados. A descrição do primeiro build acima registra o estado anterior à migração.

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

### Iniciar a primeira build após configurar a branch

Salvar os comandos e a branch não inicia uma build. Depois de cadastrar os quatro segredos em **Compilações**, enviar um novo commit de `codex/cloudflare-production` ao `origin` dispara a compilação e a implantação configuradas. No GitHub Desktop, conferir o repositório e a branch e clicar em **Push origin**.

Acompanhar em **Implantações → Ver histórico de builds** e confirmar a branch e o commit recém-enviado. Não repetir a build antiga da `main` para tentar publicar o código da branch nova. O campo `name` continua sendo `insitituto-bicalho` na configuração de produção.

O token gerado pelo Workers Builds deve conseguir consultar e atualizar este Worker nesta conta. O publicador valida conta, nome, branch, pacote, rotas dinâmicas, indexação oficial e bloqueio do host temporário antes de executar Wrangler. As chaves do banco não fazem parte do Git nem do ambiente isolado usado pelo Astro. Os segredos cadastrados em Compilações ficam disponíveis somente ao publicador para completar os vínculos de execução ausentes.

## Antes do primeiro deploy do candidato

O Worker antigo contém apenas arquivos estáticos; nesse estado, o painel bloqueia o cadastro de segredos de execução. Para a primeira publicação, usar os quatro valores cadastrados como **Secret** em **Configurações → Compilações → Variáveis e segredos**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BLOG_CRON_SECRET`

Usar o projeto Supabase confirmado para a publicação definitiva. A chave de serviço é privada; não colocar em variável `PUBLIC_`, no chat ou no repositório.

O publicador consulta somente os nomes dos segredos de execução. Para cada nome ausente, exige o valor correspondente de Compilações e o envia junto com o servidor SSR usando [`wrangler deploy --secrets-file`](https://developers.cloudflare.com/workers/configuration/secrets/#upload-secrets-alongside-code). Valores já existentes no Worker não são substituídos, mesmo que Compilações contenha valores diferentes. Se faltar algum valor necessário, a implantação para antes do upload e informa apenas os nomes pendentes.

O arquivo JSON temporário fica fora do checkout e dos artefatos, com diretório `0700` e arquivo `0600` no ambiente Linux do Workers Builds. É removido ao terminar, inclusive em falhas; valores não são impressos. O processo força a sanitização dos logs, desativa o arquivo de debug do Wrangler e não gera formulários de upload para diagnóstico. Após publicar, consulta novamente os nomes dos quatro vínculos. A confirmação dos nomes não prova a validade dos valores: conferir o blog público e a API de sessão, além dos fluxos autenticados e de agendamento.

Nas próximas implantações, se os quatro segredos de execução já existirem, nenhum arquivo de segredos será criado; o Wrangler preservará os valores existentes.

Dois Workers com o mesmo Supabase compartilham os mesmos artigos, usuários e alterações. Antes de habilitar edição no candidato, definir a promoção do banco atual ou a migração para outro projeto, com cópia de segurança. Não criar um segundo agendador apontando para o mesmo banco. Rever Supabase Auth Site URL, URLs de retorno para convites/recuperação e o destino do Cron; SMTP deve continuar pertencendo ao Instituto.

## Sequência para conectar o domínio

1. Validar o candidato em `https://insitituto-bicalho.cbicalhogarcia.workers.dev`: páginas, blog, painel, imagens, formulários, login, publicação e e-mails. Ainda ficará com `noindex` e sem demonstrações públicas.
2. Conferir o backup DNS, serviços existentes e redirecionamentos antigos. O export de 2026-11-09 mostra apex em `target.rockfunnels.com`, `www` apontando para o apex, MX da Titan e subdomínios independentes. `cpanel` e `ftp` também apontam para o apex e exigem revisão antes da troca. Preservar os registros de e-mail e subdomínios não envolvidos.
3. Preparar a mudança de produção em separado: configuração dos Custom Domains, escolha de endereço canônico e redirecionamento do outro hostname, SSL, indexação e sitemap. O guard deste candidato não permite essa mudança implicitamente.
4. Realizar a troca somente depois dos testes e da confirmação do responsável; verificar domínio com e sem `www`, HTTPS, blog, painel, links de recuperação, robots e canonical.
5. Registrar versão/commit e plano de retorno. Manter a prévia bloqueada para indexação; não liberar demonstrações nem rascunhos.

## Verificação local

`npm run test:seo:policy` verifica a separação de hosts e rotas privadas. `npm run test:sitemap` verifica inclusão e retirada de publicações usando fixtures, sem modificar o banco. Para a auditoria hospedada, executar `test:seo` com `TEST_URL=https://institutobicalho.com`; endereços temporários continuam esperando bloqueio de indexação.

`npm run test:cloudflare:production` testa os bloqueios da configuração e a primeira implantação com valores fictícios, sem rede: preenchimento somente dos vínculos ausentes, preservação dos existentes, erros específicos, isolamento e limpeza do arquivo temporário em sucesso/falha.

`npm run build:cloudflare:production` executa Astro Check, compila, compara a fonte antes/depois e grava a impressão digital do pacote em `artifacts/provision/cloudflare-production-build.json`.

`npm run check:cloudflare:production` verifica o pacote sem publicar. Os comandos de validação não modificam banco, domínio ou DNS.
