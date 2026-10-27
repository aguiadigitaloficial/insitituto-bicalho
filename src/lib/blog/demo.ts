import {emptySnapshot,type Snapshot} from './model';
// Explicit editorial demonstrations, not health advice or client-approved articles.
export const demoTitles=[
 'Demonstração: conheça a organização dos conteúdos do Instituto Bicalho',
 'Demonstração: os ambientes do Instituto em uma seleção de fotografias',
 'Demonstração: uma publicação com índice, imagens e legenda',
 'Demonstração: como as categorias organizam as publicações do Blog',
 'Demonstração: uma leitura com subtítulos e diferentes formatos de texto',
 'Demonstração: a apresentação de um artigo em celulares e tablets',
 'Demonstração: autoria institucional e informações de publicação',
 'Demonstração: imagens da estrutura de atendimento do Instituto',
 'Demonstração: seleção editorial com publicações relacionadas',
 'Demonstração: uma publicação com título completo para conferir a leitura em diferentes tamanhos de tela',
 'Demonstração: informações organizadas em listas e tabelas',
 'Demonstração: prévia dos campos de busca e compartilhamento',
];
export function demoSnapshot(index:number,authorId:string,categoryId:string,coverId:string):Snapshot{
 const s=emptySnapshot();Object.assign(s,{title:demoTitles[index],slug:`demonstracao-editorial-${index+1}`,authorId,categoryIds:[categoryId],primaryCategoryId:categoryId,coverId,excerpt:'Publicação de demonstração para conferir o funcionamento do Blog. Este conteúdo será removido antes da migração definitiva.',featured:index<5});
 const text=(value:string)=>({type:'text',text:value});const paragraph=(value:string)=>({type:'paragraph',content:[text(value)]});const heading=(value:string,level=2)=>({type:'heading',attrs:{level},content:[text(value)]});
 s.content={type:'doc',content:[paragraph('Este artigo é uma demonstração do painel editorial do Instituto Bicalho. O texto permite verificar a apresentação do conteúdo e não contém orientações clínicas.'),heading('Organização da publicação'),paragraph('Título, autoria, data e categoria ajudam o visitante a reconhecer a publicação. O índice permite navegar diretamente pelos subtítulos.'),heading('Imagem institucional'),{type:'image',attrs:{assetId:coverId}},paragraph('A fotografia apresenta um ambiente do Instituto. Texto alternativo, legenda, crédito e direitos autorais podem ser configurados na biblioteca de mídia.'),heading('Diferentes formatos de leitura'),{type:'bulletList',content:['Parágrafos com largura de leitura confortável.','Subtítulos completos, sem cortes.','Links para outras publicações do Blog.'].map(t=>({type:'listItem',content:[paragraph(t)]}))},{type:'blockquote',content:[paragraph('Conteúdo demonstrativo para revisão de layout e funcionamento.')]},heading('Um exemplo de tabela',3),{type:'table',content:[{type:'tableRow',content:['Campo','Finalidade'].map(t=>({type:'tableHeader',content:[paragraph(t)]}))},{type:'tableRow',content:['Trecho','Apresentação nas listagens'].map(t=>({type:'tableCell',content:[paragraph(t)]}))},{type:'tableRow',content:['Meta description','Descrição configurada para mecanismos de busca'].map(t=>({type:'tableCell',content:[paragraph(t)]}))}]},heading('Continuidade da leitura'),paragraph('Os conteúdos relacionados aparecem ao lado do artigo em telas maiores e abaixo da leitura no celular. A seleção pode ser feita pelo responsável editorial.'),paragraph('Ao final dos testes, esta publicação de demonstração será excluída do conjunto de dados levado para o projeto do cliente.')]};return s;
}
