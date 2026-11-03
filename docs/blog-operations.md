# Blog editorial — prévia Cloudflare e Supabase

A branch `codex/cloudflare-blog` prepara um Worker exclusivo em conta do Instituto. A Vercel, o domínio institucional, a branch principal e sua indexação permanecem fora desta publicação.

## Ambiente e acesso

1. Usar somente o projeto Supabase isolado do Instituto. Conferir organização, proprietário e plano Free antes de aplicar todas as migrations versionadas em ordem. A conta da plataforma é separada dos usuários convidados do blog.
2. No Auth, desativar cadastro público e acesso anônimo; preservar confirmação de e-mail. Definir Site URL como a origem exata da prévia e permitir seus callbacks e `/admin/?password=1`, incluindo equivalentes locais quando necessários.
3. Convidar o proprietário editorial e cadastrar seu UUID em `blog_members` com role `owner`. Somente o proprietário administra convites; autores públicos são cadastros separados. Nunca versionar ou enviar senhas e chaves em mensagens.
4. Guardar credenciais de provisionamento em `.env.provision.local` e as variáveis do aplicativo em `.env.blog.local`, ambos ignorados. O runtime recebe `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `BLOG_CRON_SECRET` pelo mecanismo de secrets do Worker. A chave de serviço nunca usa prefixo PUBLIC.
5. A prévia exige `BLOG_HOST=cloudflare`, `BLOG_ENVIRONMENT=preview`, `BLOG_DEMO=true` e `PUBLIC_INDEXABLE=false`. As páginas anteriores continuam estáticas; blog, painel, API e sitemap são renderizados pelo Worker.
6. O Supabase de teste usa SMTP da conta Brevo Free do Instituto (`institutobicalho.site@outlook.com`), sem cartão ou contratação paga. Host `smtp-relay.brevo.com`, porta 587, remetente verificado e nome “Instituto Bicalho Odontologia de Precisão”. A senha fica somente na configuração privada do Supabase e em `.env.smtp.local`, ignorado pelo Git; não é enviada ao Worker. Uma resposta aceita pela API não comprova entrega.

O callback entende os templates com `token_hash` e os fragmentos de sessão dos templates padrão; valida os tokens no próprio servidor e remove-os do endereço. Links privados e painel têm `private, no-store` e noindex.

### Entrega e manutenção do SMTP

O teste real usou um endereço adicional do próprio Instituto, distinto do proprietário (`institutobicalho.site+editor-teste@outlook.com`). Convite, definição de senha, login, recuperação PKCE, rejeição da senha anterior, novo login e publicação por editor foram conferidos. O editor não conseguiu convidar outro usuário nem acessar os controles do proprietário. Os registros descartáveis foram removidos.

Os e-mails chegaram ao **Lixo Eletrônico do Outlook**. A identificação do Instituto foi preservada, mas não há domínio próprio de envio autenticado nesta etapa; não prometer entrega na caixa principal. Não houve alteração de DNS, inclusão em lista de remetentes confiáveis nem redução de proteções da caixa. A autenticação de um domínio remetente poderá ser feita depois, com autorização e acesso ao DNS.

Usar o link mais recente e consumi-lo prontamente, no navegador em que a recuperação foi solicitada. Links usados ou expirados são recusados; o painel apresenta a mensagem de link inválido/expirado e permite solicitar outro. Os links e as senhas de teste ficam apenas em arquivos privados de `artifacts/blog-smtp/`, removidos ao concluir o teste. O relatório não contém credenciais.

O Brevo Free tem limite de 300 mensagens diárias. A chave criada em 30/10/2026 tem validade de um ano; o provedor também informa expiração após 90 dias de inatividade. Conferir o painel antes de uso prolongado e renovar quando necessário, atualizando somente o SMTP do Supabase. Convites e recuperação consomem a mesma cota. Não há contratação automática ao excedê-la.

## Build e publicação isolada

Usar Node 24. O build padrão mantém a configuração Vercel; `npm run build:cloudflare` produz `dist-cloudflare/` separadamente. O comando de publicação verifica conta explícita do Instituto, token de conta ativo, branch `codex/`, nome exato do Worker, ausência de rotas/domínios adicionais, noindex e pacote sem credenciais incorporadas. Não utiliza o login global da agência.

O build Cloudflare só grava sua assinatura de arquivos após compilação bem-sucedida. A publicação compara essa assinatura com os arquivos atuais de código, fotografias e configuração e recusa pacotes desatualizados. Relatórios e documentação não alteram a assinatura do produto.

```powershell
npm run build:cloudflare
node --env-file=.env.provision.local --env-file=.env.blog.local scripts/deploy-cloudflare-preview.mjs
npm run deploy:cloudflare:preview
```

O segundo comando apenas verifica; o terceiro publica o Worker de prévia e seus secrets de forma conjunta. O arquivo JSON temporário de secrets fica dentro de `artifacts/`, ignorado. Relacionar implantação e commit e conferir a URL pública antes da entrega. Não habilitar domínio próprio, indexação ou plano pago automaticamente.

## Mídia, demonstrações e agendamento

### Exemplos preparados para apresentação

`scripts/blog-presentation.ts` substitui somente as 12 demonstrações iniciais identificadas, usando `scripts/fixtures/blog-presentation.ts`. Exige o projeto, o endereço e o ambiente de prévia confirmados, além do proprietário institucional. O comando sem `--apply` é uma simulação; com `--apply`, guarda backup local ignorado, preserva revisões e o rascunho original, atualiza os exemplos e prepara um rascunho adicional para testes manuais. Uma segunda execução não duplica os exemplos nem gera revisões sem alterações. O seed inicial se recusa a recriar os exemplos genéricos numa prévia já personalizada.

Os exemplos usam autoria institucional e continuam com `is_demo=true`. Tags, relacionados, miniatura independente, meta description separada do trecho, compartilhamento e um complemento JSON-LD de FAQ estão preenchidos. O FAQ complementar corresponde ao conteúdo visível do artigo de agendamento. A marcação automática de BlogPosting continua sendo gerada pelo site.

Os primeiros registros de mídia tinham um carimbo calculado antes da ordenação das chaves pelo JSONB. O preparo reconhece somente esse carimbo legado conhecido, confere a existência de todas as variantes públicas e normaliza o carimbo, sem regenerar pixels. Não altera os metadados de biblioteca de imagens usadas em rascunhos não demonstrativos.

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
- `test:blog:editor:live`: opera os controles pela interface em Chromium e WebKit, salva/reabre/publica e verifica HTML, H2/H3 e índice, formatação, tabelas, biblioteca, metadados, revisões, retirada/lixeira/restauração e agendamento. Usa contas descartáveis no ambiente de teste, sem alterar a senha do proprietário.
- `node --env-file=.env.blog.local --import tsx scripts/blog-admin-resize-live-check.ts`: conferência hospedada de todas as abas e dos diálogos de seleção/envio de imagem e revisões, com texto a 100% e 200%, incluindo 320 px. Mantém a fonte ampliada e remove somente seus próprios registros descartáveis. Evidências em `artifacts/blog-admin-resize/`.
- `scripts/blog-smtp-check.ts`: teste em fases (`invite`, `accept`, `recover`, `finish`, `cleanup`) restrito ao projeto e à prévia aprovados. O link de cada mensagem real é conferido e exportado pela interface da caixa autorizada, nunca por resposta simulada. Consumir a recuperação dentro do prazo do fluxo PKCE. O relatório distingue entrega no Lixo Eletrônico de entrega na caixa principal.

Para migrar no futuro, criar destino vazio, aplicar todas as migrations versionadas e exportar/importar com `scripts/blog-transfer.ts`. Excluir demonstrações e acessos de teste; preservar IDs de mídia, slugs, revisões, arquivos e copyright. Recriar convites e SMTP, URLs, secrets e Cron; conferir contagens e hashes antes de trocar a origem ativa. Pausar o publicador anterior durante a troca para evitar duplicação. Manter o ambiente anterior disponível para retorno até a aprovação.

Retirar um artigo oculta sua página, mas não revoga cópias de imagens públicas já compartilhadas. Alterações de imagem geram caminhos novos; originais continuam privados.


## Pendências e publicação (03/11/2026)

Selecionar a categoria principal também inclui essa categoria no artigo. As categorias adicionais usam caixas de seleção. Para remover a principal, selecionar outra ou limpar a definição. Rascunhos antigos inconsistentes mostram o vínculo pendente; abrir o artigo não salva nem corrige dados automaticamente.

O JSON-LD complementar é texto no rascunho e pode ser salvo incompleto. Publicar, atualizar e agendar exigem validação completa. A prévia privada mostra as pendências e omite todo complemento inválido. BlogPosting, autoria e navegação continuam automáticos; não copiar esses blocos para o campo complementar. Metatags adicionais continuam exigindo sua estrutura válida no salvamento.

O resumo persistente direciona à aba e ao campo. O checklist distingue obrigatórios de recomendações; a capa permanece opcional. A validação local e `/api/blog/validate-publication/` precedem o preparo de mídia. Uma tentativa usa somente a revisão salva capturada e desativa controles temporariamente. A migration `202611030001_publication_revision_guard.sql` recusa revisões manuais antigas dentro da transação; agendamentos mantêm sua revisão explícita e a mesma publicação atômica.

Erros retornam `error`, `code`, `fields`, `requestId` e, quando pertinente, `issues`. Pendências editoriais usam 422; concorrência usa 409; falhas internas/dependências usam 5xx. O identificador também está em `X-Request-Id`. Os logs `[blog]` registram somente ação, código, status, campos e referência, sem corpo, senha ou token. Consultar exclusivamente `cloudflare-workers`, com filtro `$workers.scriptName = instituto-bicalho-blog-preview`; nunca consultar todas as contas/projetos. Após conflito, preservar/copiar mudanças pendentes antes de reabrir o artigo.

Os testes novos de Worker cobrem rascunho legado sem alteração ao abrir, JSON incompleto/duplicado, prévia segura, 422/409/500/502, falha de mídia sem marcar prontidão, clique duplicado, concorrência e 320–2560 px com texto a 200% nos dois motores. O teste hospedado também reproduz as pendências com registros descartáveis. Somente UUIDs criados por cada execução são removidos.
