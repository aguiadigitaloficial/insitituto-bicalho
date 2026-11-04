# Equipe de João Monlevade — 04/11/2026

Atualização publicada somente na prévia Cloudflare, na seção “Conheça nossa equipe” da Home. A equipe tem 20 cadastros: Lívia foi atualizada e seis integrantes foram acrescentados. Os 14 nomes e suas descrições clínicas anteriores foram preservados; os três cadastros de Belo Horizonte continuam como estavam.

Os retratos seguem a ordem confirmada: Wanuza (foto 13), Dra. Lívia Teixeira (12), Irlam (11), Iara (10), Bianca (9), Eloiza (8) e Matheus Souza (7). A fotografia conjunta dos sócios continua na apresentação existente, usando o original anterior em maior resolução. As fotos 1–6 estão arquivadas sem vínculo com nomes.

Os 14 anexos foram copiados sem alterar seus bytes para `assets/originals/team-jm-20261104/`, ignorado pelo Git. Os sete retratos identificados têm 42 arquivos WebP/AVIF em 480, 800 e resolução nativa (1066/1067 px), sem ampliação. Título, descrição alternativa e direitos autorais do Instituto estão configurados. O componente usa uma largura existente nos fallbacks e nas URLs de metadados; os conjuntos antigos de imagem foram preservados.

A galeria usa uma, duas e três colunas a partir de 320, 600 e 1200 px, com recorte 4:5 e molduras de 16 px. Os profissionais sem retrato identificado continuam em uma grade de texto abaixo. As capturas da galeria omitem os controles fixos somente durante a captura, para permitir a revisão dos retratos completos.

Validação: build Cloudflare sem erros; 42 variantes conferidas localmente quanto a dimensões, título e copyright EXIF/XMP; fontes originais conferidas por SHA-256. Chromium e WebKit passaram por 52 casos de reflow entre 320 e 2560 px a 100%/200%, 12 combinações de densidade 2×/3×, leitura sem JavaScript e abertura/fechamento da equipe. A conferência foi repetida na hospedagem. As larguras são simuladas por navegador.

A comparação confirma os 120 blocos da Home fora da equipe intactos; o baseline completo foi atualizado somente para a alteração autorizada e passou em dez páginas/959 blocos. A regressão hospedada passou em nove rotas e 36 combinações responsivas, sem violações de acessibilidade detectadas, incluindo menu, agendamento, FAQ e consentimento. Os testes de movimento passaram localmente. Blog e painel responderam 200, com bloqueio de indexação preservado.

Commit do produto: `7d6ca66`. Worker: `b6dc338c-91dc-48f7-be9f-a8ec904ddd55`, em 100% do tráfego da prévia, com anotação `Bicalho preview 7d6ca66`. Site principal, domínio, Supabase e DNS não foram alterados.

Evidências locais ignoradas pelo Git: `artifacts/team-jm/report.json`, `deployment.json`, capturas `team-390-chromium.png`, `team-834-chromium.png`, `team-1366-chromium.png` e equivalentes WebKit.
