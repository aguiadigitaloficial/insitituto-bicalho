# Reteste do erro de publicação — 03/11/2026

O erro genérico da captura não reapareceu no fluxo reproduzido. O teste foi executado na prévia Cloudflare publicada, em sessões novas de Chrome e WebKit, com usuário editor descartável.

Foi usada uma cópia da revisão 34 do artigo que falhou: mesmo título, texto completo, configurações e cinco imagens referenciadas. Os arquivos originais foram reenviados pela interface; seus bytes foram conferidos por SHA-256. Apenas os identificadores de mídia e o endereço temporário diferiram, e a cópia foi identificada como demonstração.

| Reprodução | Chrome | WebKit |
|---|---|---|
| Categoria principal indicada, mas fora das categorias selecionadas | Aviso específico e foco no campo; nenhum preparo de imagens iniciado | Mesmo resultado |
| Chamada direta ao mesmo `/api/blog/prepare-media/` da captura, com a pendência | 422, com `categoryIds`, mensagem e referência de diagnóstico | Mesmo resultado |
| Marcar a categoria já indicada e clicar em Publicar | Preparo e publicação 200; artigo e imagens conferidos na página pública | Mesmo resultado |
| Salvar/reabrir JSON-LD incompleto ou BlogPosting complementar duplicado | Rascunho preservado; pendência específica impede atualização; prévia omite complemento; versão pública permanece intacta | Mesmo resultado |
| Restaurar JSON-LD válido e clicar em Atualizar | Atualização 200 | Atualização 200 |
| Erros de JavaScript, console e requisições falhas no fluxo da interface | Zero | Zero |

A publicação foi concluída após corrigir somente o vínculo da categoria **Odontologia de Precisão**. A categoria já estava definida como principal, mas sua caixa não estava marcada. Essa inconsistência continua exigindo correção nos rascunhos antigos; agora o painel explica o motivo.

Ao terminar, os hashes do artigo original, de todas as suas 34 revisões e dos registros de mídia permaneceram idênticos. As duas contas, os dois artigos e as dez cópias de imagens criados pelo teste foram removidos. O código do aplicativo e a hospedagem não precisaram de nova alteração.

O teste usa motores de navegador em computador, não o dispositivo físico do cliente. A chamada direta de diagnóstico retornou 422 intencionalmente; isso não é uma falha do fluxo corrigido da interface.

Evidências locais: [relatório detalhado](../artifacts/blog-client-repro/report.json), [publicação no Chrome](../artifacts/blog-client-repro/publicacao-concluida-chromium.png), [publicação no WebKit](../artifacts/blog-client-repro/publicacao-concluida-webkit.png) e [aviso da categoria](../artifacts/blog-client-repro/categoria-pendente-chromium.png). Os relatórios e capturas permanecem fora do Git.
