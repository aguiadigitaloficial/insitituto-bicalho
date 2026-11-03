import {areas, units, homeQuestions} from '../../src/data/content';
import {emptySnapshot, type Snapshot} from '../../src/lib/blog/model';

// Presentation samples use the approved institutional copy, not new clinical advice.
type Node = Record<string, any>;
const text=(value:string,marks?:Node[])=>({type:'text',text:value,...(marks?{marks}:{})});
const p=(value:string):Node=>({type:'paragraph',content:[text(value)]});
const h=(value:string,level=2):Node=>({type:'heading',attrs:{level},content:[text(value)]});
const list=(items:string[],ordered=false):Node=>({type:ordered?'orderedList':'bulletList',content:items.map(value=>({type:'listItem',content:[p(value)]}))});
const link=(label:string,href:string):Node=>({type:'paragraph',content:[text(label,[{type:'link',attrs:{href,target:null,rel:'noopener noreferrer'}}])]});
const photo=(assetId:string):Node=>({type:'image',attrs:{assetId}});
const quote=(value:string):Node=>({type:'blockquote',content:[p(value)]});
const table=(head:string[],rows:string[][]):Node=>({type:'table',content:[{type:'tableRow',content:head.map(value=>({type:'tableHeader',content:[p(value)]}))},...rows.map(row=>({type:'tableRow',content:row.map(value=>({type:'tableCell',content:[p(value)]}))}))]});
const care='A equipe reúne implantodontia, ortodontia, odontopediatria, prótese dentária, endodontia, periodontia e harmonização orofacial, com planejamento conjunto quando o caso exige mais de uma especialidade.';
const assessment='O acompanhamento começa pela queixa e pelo histórico do paciente, segue para o exame clínico e, quando indicado, para o planejamento digital antes de qualquer procedimento.';
const evaluation=():Node=>({type:'paragraph',content:[text('Avaliação individualizada',[{type:'bold'}]),text(' antes de qualquer tratamento.')]});
const note:Node={type:'paragraph',content:[text('Texto de apresentação, elaborado a partir dos conteúdos institucionais do site. Publicação demonstrativa, sujeita à revisão do Instituto antes da divulgação definitiva.',[{type:'italic'}])]};
const area=(slug:string)=>areas.find(a=>a.slug===slug)!;
const faq=homeQuestions[0];

export const presentationArticles=[
 {title:'Como agendar sua avaliação no Instituto Bicalho',slug:'como-agendar-avaliacao-instituto-bicalho',category:'tratamentos',tags:['Atendimento','Unidades'],keyword:'avaliação',featured:true,
  excerpt:'Veja os contatos das unidades de João Monlevade e Belo Horizonte e como dar o primeiro passo para conversar com a equipe.',
  description:'Agende uma avaliação no Instituto Bicalho. Consulte os contatos de João Monlevade e Belo Horizonte e escolha a unidade em que deseja atendimento.',
  body:(id:string)=>[
   p('O Instituto Bicalho atende em João Monlevade e Belo Horizonte. O contato com a equipe é feito pelo WhatsApp da unidade em que você deseja atendimento.'),
   h('Escolha sua unidade'),table(['Unidade','Telefone e WhatsApp'],units.map(u=>[u.name,u.display])),
   h('Converse com a equipe'),list(['Escolha a unidade em que deseja atendimento.','Conte à equipe o motivo do seu contato.','Converse sobre o agendamento da avaliação.'],true),
   photo(id),h('A avaliação é o ponto de partida'),evaluation(),p(assessment),
   h('Uma dúvida frequente'),h(faq[0],3),p(faq[1]),link('Ver os contatos e endereços das unidades','/contato/')],
 },
 {title:'Conheça os ambientes do Instituto Bicalho',slug:'ambientes-instituto-bicalho',category:'tratamentos',tags:['Unidades','Atendimento'],keyword:'Instituto Bicalho',featured:false,
  excerpt:'Recepção, consultórios e espaços de atendimento fazem parte da experiência de quem chega ao Instituto para uma avaliação.',
  description:'Conheça os ambientes do Instituto Bicalho e encontre os contatos das unidades de João Monlevade e Belo Horizonte para conversar com a equipe.',
  body:(id:string)=>[p('Antes da consulta, conhecer o espaço de atendimento ajuda a se familiarizar com o Instituto. Nesta seleção, a fotografia mostra um dos consultórios do acervo institucional.'),h('Um olhar para o consultório'),photo(id),p('A imagem reúne a cadeira odontológica, a bancada e a mesa de atendimento. O espaço aparece aqui como parte da apresentação institucional.'),h('O atendimento começa com uma conversa'),p(assessment),evaluation(),h('Duas unidades'),table(['Cidade','Endereço'],units.map(u=>[u.name,`${u.address}. CEP ${u.postalCode}.`])),link('Consultar localização e canais de atendimento','/contato/')],
 },
 {title:'Avaliação individualizada: o primeiro passo do atendimento',slug:'avaliacao-individualizada-primeiro-passo',category:'tratamentos',tags:['Atendimento','Planejamento'],keyword:'avaliação',featured:false,
  excerpt:'A queixa, o histórico do paciente e o exame clínico fazem parte da conversa que orienta o planejamento de cada atendimento.',
  description:'Conheça a proposta de avaliação individualizada do Instituto Bicalho e como a conversa com o dentista orienta o planejamento do atendimento.',
  body:(id:string)=>[evaluation(),p(assessment),h('Da primeira conversa ao planejamento'),p(area('tratamentos').intro),h('Quando há mais de uma especialidade',3),p(care),photo(id),h('Saúde bucal e reabilitação'),list(area('tratamentos').services.map(s=>s.title)),p(area('tratamentos').questions[0][1]),link('Conhecer a área de Tratamentos','/tratamentos/')],
 },
 {title:'Odontologia de Precisão: do diagnóstico ao planejamento',slug:'odontologia-precisao-diagnostico-planejamento',category:'odontologia-de-precisao',tags:['Tecnologia digital','Planejamento'],keyword:'planejamento',featured:true,
  excerpt:'Entenda como a avaliação clínica e os recursos digitais são apresentados na proposta de cuidado do Instituto Bicalho.',
  description:'Conheça a Odontologia de Precisão no Instituto Bicalho: avaliação clínica, escaneamento intraoral e planejamento digital do atendimento.',
  body:(id:string)=>[p(area('odontologia-de-precisao').intro),h('A avaliação vem primeiro'),p(assessment),photo(id),h('Recursos que fazem parte dessa área'),list(area('odontologia-de-precisao').services.map(s=>s.title)),h('Planejamento individualizado',3),evaluation(),p(care),link('Conhecer os recursos de Odontologia de Precisão','/odontologia-de-precisao/')],
 },
 {title:'Uma equipe, várias especialidades',slug:'equipe-varias-especialidades',category:'ortodontia-e-cirurgia',tags:['Equipe','Planejamento'],keyword:'equipe',featured:true,
  excerpt:'O trabalho conjunto entre especialidades faz parte do planejamento dos atendimentos do Instituto Bicalho.',
  description:'Conheça a proposta de trabalho em equipe do Instituto Bicalho, com diferentes especialidades e avaliação individualizada antes dos tratamentos.',
  body:(id:string)=>[p(care),h('Planejamento conjunto'),p(assessment),photo(id),h('A especialidade faz parte de um plano'),p(area('ortodontia-e-cirurgia').intro),h('Profissionais e áreas de atuação',3),p('A apresentação completa dos profissionais e de suas áreas de atuação está disponível na página inicial do Instituto.'),evaluation(),link('Conhecer a equipe do Instituto','/#equipe'),link('Ver a área de Ortodontia e Cirurgia','/ortodontia-e-cirurgia/')],
 },
 {title:'Estética do sorriso: uma conversa sobre suas expectativas',slug:'estetica-sorriso-expectativas',category:'estetica',tags:['Estética do sorriso','Planejamento'],keyword:'Estética',featured:true,
  excerpt:'Cor, formato dos dentes e expectativas entram na conversa sobre o planejamento dos cuidados com o sorriso.',
  description:'Conheça a proposta de avaliação em estética dental do Instituto Bicalho e os temas que fazem parte da conversa sobre seu sorriso.',
  body:(id:string)=>[p(area('estetica').intro),h('O que você deseja mudar?'),p('A conversa sobre as expectativas faz parte da avaliação. As possibilidades de cada procedimento são discutidas a partir das condições de cada pessoa.'),evaluation(),photo(id),h('Conheça a área de Estética'),list(area('estetica').services.map(s=>s.title)),h('Dúvidas que podem fazer parte da consulta',3),p(area('estetica').questions[0][1]),link('Consultar os procedimentos da área de Estética','/estetica/')],
 },
 {title:'Escaneamento, planejamento e execução: conheça o fluxo digital',slug:'escaneamento-planejamento-execucao-fluxo-digital',category:'odontologia-de-precisao',tags:['Tecnologia digital','Planejamento'],keyword:'planejamento',featured:false,
  excerpt:'A apresentação do fluxo digital do Instituto é organizada em três etapas: escaneamento, planejamento e execução.',
  description:'Conheça as três etapas do fluxo digital apresentadas pelo Instituto Bicalho: escaneamento intraoral, planejamento e execução do tratamento.',
  body:(id:string)=>[p('O escaneamento intraoral substitui a moldagem tradicional e alimenta o planejamento digital, do dente único à reabilitação completa.'),h('Escaneamento'),p('Captura intraoral digital. Substitui a moldagem tradicional e registra a arcada em poucos minutos.'),h('Planejamento'),p('Simulação do tratamento. A equipe define etapas e antecipa o resultado antes de iniciar o procedimento.'),photo(id),h('Execução'),p('Procedimento guiado pelo plano. O tratamento segue o planejamento definido com o paciente.'),h('A avaliação orienta o uso desses recursos',3),p(assessment),link('Ver o fluxo digital no site do Instituto','/odontologia-de-precisao/')],
 },
 {title:'Ortodontia e cirurgia: cuidados organizados em um mesmo plano',slug:'ortodontia-cirurgia-planejamento',category:'ortodontia-e-cirurgia',tags:['Planejamento','Equipe'],keyword:'Ortodontia',featured:false,
  excerpt:'Conheça a área de Ortodontia e Cirurgia e a proposta de avaliação que organiza os cuidados de acordo com cada caso.',
  description:'Conheça a área de Ortodontia e Cirurgia do Instituto Bicalho e como a avaliação individualizada orienta a conversa sobre o tratamento.',
  body:(id:string)=>[p(area('ortodontia-e-cirurgia').intro),h('A conversa antes do tratamento'),p(assessment),evaluation(),photo(id),h('Áreas de atendimento'),list(area('ortodontia-e-cirurgia').services.map(s=>s.title)),h('Quando o caso envolve mais de uma especialidade',3),p(care),link('Conhecer os atendimentos de Ortodontia e Cirurgia','/ortodontia-e-cirurgia/')],
 },
 {title:'Planejamento do sorriso: cada pessoa tem um ponto de partida',slug:'planejamento-sorriso-avaliacao',category:'estetica',tags:['Estética do sorriso','Atendimento'],keyword:'sorriso',featured:false,
  excerpt:'A avaliação considera a saúde bucal e as características de cada pessoa antes da conversa sobre mudanças no sorriso.',
  description:'Conheça a proposta de planejamento do sorriso no Instituto Bicalho, com avaliação individualizada e conversa sobre as possibilidades de cuidado.',
  body:(id:string)=>[p(area('estetica').intro),h('Um ponto de partida individual'),evaluation(),p(assessment),photo(id),h('Saúde e características do sorriso'),p(area('estetica').questions[0][1]),h('Conhecer as possibilidades',3),list(area('estetica').services.map(s=>s.title)),link('Ler sobre os cuidados de Estética','/estetica/')],
 },
 {title:'Acompanhamento e diálogo ao longo do atendimento',slug:'acompanhamento-dialogo-atendimento',category:'ortodontia-e-cirurgia',tags:['Atendimento','Equipe'],keyword:'atendimento',featured:false,
  excerpt:'A queixa e o histórico do paciente fazem parte do acompanhamento e da conversa com a equipe do Instituto.',
  description:'Conheça a proposta de acompanhamento do Instituto Bicalho e os canais para conversar com a equipe nas duas unidades.',
  body:(id:string)=>[p(assessment),h('A conversa faz parte do cuidado'),p(care),quote('Saúde, função e estética. Juntas.'),photo(id),h('Converse com a sua unidade'),table(['Unidade','WhatsApp'],units.map(u=>[u.name,u.display])),h('Conhecer o atendimento disponível',3),p(area('ortodontia-e-cirurgia').intro),link('Falar com a equipe do Instituto','/contato/')],
 },
 {title:'Tecnologia e avaliação clínica no planejamento do atendimento',slug:'tecnologia-avaliacao-clinica-planejamento',category:'odontologia-de-precisao',tags:['Tecnologia digital','Equipe'],keyword:'planejamento',featured:false,
  excerpt:'Os recursos digitais fazem parte de um planejamento que começa com a conversa e a avaliação clínica do paciente.',
  description:'Conheça a relação entre avaliação clínica e recursos digitais na proposta de Odontologia de Precisão do Instituto Bicalho.',
  body:(id:string)=>[p(assessment),h('A avaliação como ponto de partida'),evaluation(),p(area('odontologia-de-precisao').intro),photo(id),h('Recursos da Odontologia de Precisão'),list(area('odontologia-de-precisao').services.map(s=>s.title)),h('O planejamento pode envolver diferentes áreas',3),p(care),link('Conhecer a Odontologia de Precisão','/odontologia-de-precisao/')],
 },
 {title:'Saúde, função e estética no mesmo planejamento',slug:'saude-funcao-estetica-planejamento',category:'estetica',tags:['Estética do sorriso','Planejamento'],keyword:'planejamento',featured:true,
  excerpt:'Diferentes áreas de cuidado se encontram na proposta de atendimento individualizado do Instituto Bicalho.',
  description:'Conheça as áreas de cuidado do Instituto Bicalho e a proposta de planejamento que reúne saúde, função e estética.',
  body:(id:string)=>[quote('Saúde, função e estética. Juntas.'),p(care),h('Quatro áreas de cuidado'),table(['Área','Apresentação'],areas.map(a=>[a.title,a.homeSummary||a.short])),photo(id),h('Um planejamento para cada atendimento'),p(assessment),evaluation(),h('A conversa sobre o sorriso',3),p(area('estetica').intro),link('Conhecer o Instituto Bicalho','/#instituto')],
 },
] as const;

export function presentationSnapshot(index:number,ids:{author:string;category:string;tags:string[];cover:string;inline:string;thumbnail:string;related:string[]}):Snapshot {
 const article=presentationArticles[index],s=emptySnapshot();
 Object.assign(s,{title:article.title,slug:article.slug,authorId:ids.author,categoryIds:[ids.category],primaryCategoryId:ids.category,tagIds:ids.tags,coverId:ids.cover,thumbnailId:index===11?ids.thumbnail:'',showCover:true,excerpt:article.excerpt,featured:article.featured,relatedIds:ids.related,content:{type:'doc',content:[...article.body(ids.inline||ids.cover).filter(node=>node.type!=='image'||!!ids.inline),note]}});
 s.seo={...s.seo,title:`${article.title} | Instituto Bicalho`,description:article.description,focusKeyword:article.keyword,index:false};
 s.social={...s.social,title:article.title,description:article.excerpt,imageId:ids.cover,alt:'',twitterTitle:index===0?'Agende sua avaliação | Instituto Bicalho':'',twitterDescription:index===0?article.description:''};
 if(index===0)s.extraJsonLd=JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:[{'@type':'Question',name:faq[0],acceptedAnswer:{'@type':'Answer',text:faq[1]}}]},null,2);
 return s;
}
