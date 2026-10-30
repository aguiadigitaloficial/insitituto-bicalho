# Estado da implementação — 30/10/2026

## Ambiente atual

A branch de trabalho é `codex/cloudflare-blog`. A prévia usa Cloudflare Workers e Supabase em contas do Instituto; o endereço principal da Vercel e o domínio institucional não foram alterados.

- Prévia: https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev/conteudos/
- Painel: https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev/admin/
- Supabase de teste: `whttbjpxlxdbwiptvkbs`, organização `nhtzpxdagyqzpqjrifpu`, plano Free. Titularidade Owner conferida no painel. O usuário criou o projeto na região Canadá Central.
- Conta Cloudflare do Instituto: `7803c3e071f890d75cda7f82cc8b1f54`, e-mail verificado. Worker exclusivo `instituto-bicalho-blog-preview`, sem rotas ou domínio próprio, com indexação bloqueada.
- Três migrations aplicadas e histórico alinhado aos nomes/versões dos arquivos. Oito tabelas editoriais com RLS. Cadastro público e login anônimo desativados; callbacks restritos à prévia e ao ambiente local.
- Secrets privados configurados no Worker, Edge Function e Vault. Tokens de provisionamento de 7 dias foram autorizados pelo usuário e estão em arquivo local ignorado; não foram incorporados ao pacote nem ao Git.
- Doze publicações explicitamente demonstrativas carregadas, com fotos existentes e metadados. Nenhum conteúdo clínico foi inventado. O rascunho atual do usuário e o acesso do proprietário são preservados; a limpeza dos testes se restringe aos UUIDs criados pelos próprios testes.
- SMTP Brevo Free conectado e conferido no Supabase de teste, com remetente verificado do Instituto e identificação “Instituto Bicalho Odontologia de Precisão”. Sem cartão ou contratação paga. A chave fica fora do Git e do pacote do site.

## Verificações concluídas

- Build Cloudflare e build Vercel aprovados, com zero erros. Auditoria das dependências de produção: zero vulnerabilidades na execução.
- Onze casos de imagens verificaram orientação, formatos, copyright EXIF/XMP, pixels, transparência, ausência de GPS e conversão alternativa de AVIF em imagens grandes. Sharp fica apenas no ambiente Node; Cloudflare Images é usado no Worker.
- PostgreSQL isolado: migrations, RLS, concorrência, revisão pública imutável, aliases, lixeira, agendamento, sanitização/JSON-LD e ensaio em segundo banco limpo aprovados.
- Seis grupos de integração do Worker compilado aprovados, incluindo navegação real com `Sec-Fetch-Mode: navigate`, uploads e até 14 variantes por imagem. Máximo observado: 33 chamadas externas por ação. O teste local usa serviços simulados explicitamente identificados e não substitui o teste hospedado.
- Matriz local Cloudflare/Chromium/WebKit: 220 cenários entre 320 e 2560 px, HTML sem JavaScript, acessibilidade, texto ampliado, movimento e fotos 2×/3×. Inclui blog, artigos, categorias, tags, autores, busca e paginação. Os serviços dessa matriz usam fixtures; a integração hospedada é conferida separadamente. Suíte anterior: 230 casos responsivos, 192 casos de fotos, SEO de dez páginas/194 imagens, navegação, atendimento e consentimento.
- Auditoria tipográfica na prévia publicada: 536 verificações, 25.560 blocos medidos e zero falhas. Inclui Chromium/WebKit, texto a 200%, movimento normal/reduzido e fallback sem `text-wrap: pretty`. O observador de erros do próprio site também é verificado; erros de iframe externo são identificados separadamente no relatório.
- Integração hospedada aprovada: login, proprietário/editor, bloqueio anônimo e de convite por editor, upload assinado, otimização e original privado, rascunho inacessível, conflito de revisão, publicação em HTML, noindex, edição isolada, histórico, 301, retirada/lixeira/restauração e agendamento pelo Cron real.
- Editor pela interface na prévia publicada: 80 grupos de verificações passaram em Chromium e WebKit. Incluem todos os controles de formatação, H2/H3 no HTML e índice, upload/legenda, recarga do conteúdo salvo, capa/miniatura, autoria, categorias/tags, relacionados, SEO/social/JSON-LD, revisão histórica, atualização, retirada/lixeira/restauração, agendamento/cancelamento e mensagens de link inválido. Cada aba foi conferida em 15 larguras entre 320 e 2560 px; todas as telas de gestão e seus diálogos foram conferidos separadamente.
- Cron ativo a cada minuto, Edge Function protegida por segredo independente e respostas 200 observadas. O teste `--wait-cron` confirmou publicação automática, sem forçar o job. Registros descartáveis foram removidos.
- Comparação na URL Cloudflare publicada confirmou as dez páginas e 953 blocos de texto anteriores preservados, incluindo painéis ocultos e metadados. Somente a inclusão aprovada do link Blog é permitida.
- O proprietário confirmou que definiu e salvou a senha diretamente no painel; a sessão autenticada foi conferida sem receber ou alterar sua senha.
- SMTP real: convite e recuperação recebidos no endereço adicional de teste do Instituto, distinto do proprietário. Foram testados aceitação, definição de senha, login, recuperação PKCE, rejeição da senha anterior, novo login, rejeição de link usado e solicitação de novo link. O editor conseguiu publicar/retirar um artigo pela interface mobile e não conseguiu administrar acessos. Conta e artigos descartáveis removidos ao concluir. Não foi alterada a senha do proprietário.

As larguras são emuladas em Chromium e WebKit; não representam testes em aparelhos físicos. A configuração visual é conferida entre 320 e 2560 px, incluindo 375, 390, 393, 414, 768, 834, 1024 e notebook de 1366 × 768. Os testes de servidor isolados e as fixtures não são apresentados como prova de entrega de e-mail ou execução do Cron; essas duas integrações têm evidência hospedada própria.

Capturas da prévia publicada: [celular](../artifacts/blog-final/blog-390.png), [tablet](../artifacts/blog-final/blog-834.png), [computador](../artifacts/blog-final/blog-1366.png). Os artigos usados nos testes completos são descartáveis, identificados como demonstração, e removidos ao concluir cada execução.

### Correções encontradas na revisão

- A barra de ferramentas reflete H2/H3, marcas e listas ativos; comandos de tabela e desfazer/refazer ficam habilitados conforme o contexto.
- A publicação muda o botão para “Atualizar” imediatamente, preservando a versão pública até a atualização explícita.
- Uploads WebP no WebKit com MIME vazio usam o formato reconhecido pela extensão; a validação real dos bytes permanece no servidor.
- Campos do painel acompanham a ampliação da fonte. O aviso de resultado não intercepta os cliques nos controles mobile.
- O desenho nativo dos seletores do WebKit fica contido no formulário em 320 px. Espaços internos dos formulários e diálogos têm limites que preservam área de leitura com fonte ampliada; o atalho de acessibilidade se revela somente quando recebe foco, inclusive a 200%.
- Links do editor podem ser selecionados para edição. Links de autenticação inválidos/expirados retornam ao painel com mensagem legível, sem expor a resposta técnica da API.

A configuração força as rotas editoriais a executar o Worker antes do tratamento estático: sem isso, a navegação normal de convites recebia 404 apesar de chamadas HTTP simples funcionarem. A regressão está coberta por testes locais e hospedados.

## Limites e pendências

- Os e-mails de teste chegaram ao **Lixo Eletrônico do Outlook**, apesar do status de entrega confirmado no Brevo. O SMTP está funcional; não há garantia de caixa principal. Nesta prévia, não foi autenticado um domínio remetente por DNS nem alterada a proteção da caixa. Conferir Lixo Eletrônico e usar sempre o link mais recente prontamente.
- O Brevo Free permite até 300 mensagens diárias. A chave atual vence em 30/10/2027 e o provedor informa expiração após 90 dias de inatividade. Consultar o painel e renovar quando necessário. Não registrar senha em mensagens ou relatórios.
- Na entrega definitiva das contas, confirmar o responsável e a recuperação da caixa Outlook. Migração definitiva, domínio e indexação continuam sujeitos à autorização posterior.
- A prévia tem demonstrações públicas identificadas e indexação bloqueada. Originais e rascunhos permanecem privados. A configuração padrão da Vercel foi preservada; nenhuma publicação na produção foi feita nesta etapa.

Evidências locais em `artifacts/blog-live/`, `artifacts/blog-worker/`, `artifacts/blog-review-cloudflare/`, `artifacts/blog-editor-live/`, `artifacts/blog-smtp/`, `artifacts/blog-images/`, `artifacts/typography-review/` e `artifacts/account-setup/`. Consultar `blog-operations.md` para operação e migração. Os arquivos de estado com links e senhas descartáveis são privados e removidos; não integram o relatório entregue.
