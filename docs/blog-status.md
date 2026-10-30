# Estado da implementação — 30/10/2026

## Ambiente atual

A branch de trabalho é `codex/cloudflare-blog`. A prévia usa Cloudflare Workers e Supabase em contas do Instituto; o endereço principal da Vercel e o domínio institucional não foram alterados.

- Prévia: https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev/conteudos/
- Painel: https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev/admin/
- Supabase de teste: `whttbjpxlxdbwiptvkbs`, organização `nhtzpxdagyqzpqjrifpu`, plano Free. Titularidade Owner conferida no painel. O usuário criou o projeto na região Canadá Central.
- Conta Cloudflare do Instituto: `7803c3e071f890d75cda7f82cc8b1f54`, e-mail verificado. Worker exclusivo `instituto-bicalho-blog-preview`, sem rotas ou domínio próprio, com indexação bloqueada.
- Três migrations aplicadas e histórico alinhado aos nomes/versões dos arquivos. Oito tabelas editoriais com RLS. Cadastro público e login anônimo desativados; callbacks restritos à prévia e ao ambiente local.
- Secrets privados configurados no Worker, Edge Function e Vault. Tokens de provisionamento de 7 dias foram autorizados pelo usuário e estão em arquivo local ignorado; não foram incorporados ao pacote nem ao Git.
- Doze publicações explicitamente demonstrativas carregadas, com fotos existentes e metadados. Nenhum conteúdo clínico foi inventado. O banco ficou com apenas essas 12 publicações e um acesso do proprietário após a limpeza dos registros descartáveis dos testes.

## Verificações concluídas

- Build Cloudflare e build Vercel aprovados, com zero erros. Auditoria das dependências de produção: zero vulnerabilidades na execução.
- Dez casos de imagens verificaram orientação, formatos, copyright EXIF/XMP, pixels, transparência e ausência de GPS. Sharp fica apenas no ambiente Node; Cloudflare Images é usado no Worker.
- PostgreSQL isolado: migrations, RLS, concorrência, revisão pública imutável, aliases, lixeira, agendamento, sanitização/JSON-LD e ensaio em segundo banco limpo aprovados.
- Seis grupos de integração do Worker compilado aprovados, incluindo navegação real com `Sec-Fetch-Mode: navigate`, uploads e até 14 variantes por imagem. Máximo observado: 33 chamadas externas por ação. O teste local usa serviços simulados explicitamente identificados e não substitui o teste hospedado.
- Matriz local Cloudflare/Chromium/WebKit: 130 cenários entre 320 e 2560 px, HTML sem JavaScript, acessibilidade, texto ampliado, movimento e fotos 2×/3×. Suíte anterior: 230 casos responsivos, 192 casos de fotos, 536 verificações tipográficas, SEO de dez páginas/194 imagens, navegação, atendimento e consentimento.
- Integração hospedada aprovada: login, proprietário/editor, bloqueio anônimo e de convite por editor, upload assinado, otimização e original privado, rascunho inacessível, conflito de revisão, publicação em HTML, noindex, edição isolada, histórico, 301, retirada/lixeira/restauração e agendamento pelo Cron real.
- Cron ativo a cada minuto, Edge Function protegida por segredo independente e respostas 200 observadas. O teste `--wait-cron` confirmou publicação automática, sem forçar o job. Registros descartáveis foram removidos.
- Comparação na URL Cloudflare publicada confirmou as dez páginas e 953 blocos de texto anteriores preservados, incluindo painéis ocultos e metadados. Somente a inclusão aprovada do link Blog é permitida.
- O convite do proprietário do painel foi entregue na caixa Outlook e abriu a sessão autenticada e a janela Definir senha. A senha deve ser preenchida diretamente pelo usuário.

A configuração força as rotas editoriais a executar o Worker antes do tratamento estático: sem isso, a navegação normal de convites recebia 404 apesar de chamadas HTTP simples funcionarem. A regressão está coberta por testes locais e hospedados.

## Limites e pendências

- O envio padrão do Supabase entregou o convite ao proprietário, que é membro da organização. SMTP próprio ainda não está configurado; convites externos e maior volume de recuperação dependem dessa configuração e de nova conferência de entrega. Não apresentar convites externos como liberados.
- Confirmar a definição da senha do painel pelo proprietário e testar sua recuperação de acesso na caixa real. Não registrar senha em mensagens ou relatórios.
- Na entrega definitiva das contas, confirmar o responsável e a recuperação da caixa Outlook. Migração definitiva, domínio e indexação continuam sujeitos à autorização posterior.
- A prévia tem demonstrações públicas identificadas e indexação bloqueada. Originais e rascunhos permanecem privados. A configuração padrão da Vercel foi preservada; nenhuma publicação na produção foi feita nesta etapa.

Evidências locais em `artifacts/blog-live/`, `artifacts/blog-worker/`, `artifacts/blog-review-cloudflare/`, `artifacts/blog-images/`, `artifacts/typography-review/` e `artifacts/account-setup/`. Consultar `blog-operations.md` para operação e migração.
