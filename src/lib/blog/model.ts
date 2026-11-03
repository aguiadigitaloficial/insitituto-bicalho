import { z } from 'zod';

export const COPYRIGHT = 'Instituto Bicalho Odontologia de Precisão';
export const slugify = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function saoPauloToISO(value:string){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Informe a data e o horário de São Paulo.');
  const wall=Date.parse(value+'Z');let instant=wall;
  for(let pass=0;pass<2;pass++){const part=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',timeZoneName:'longOffset'}).formatToParts(new Date(instant)).find(p=>p.type==='timeZoneName')?.value||'GMT';const match=part.match(/GMT([+-])(\d{1,2}):(\d{2})/);const offset=match?(Number(match[2])*60+Number(match[3]))*(match[1]==='+'?1:-1):0;instant=wall-offset*60000;}
  return new Date(instant).toISOString();
}
const id = z.uuid();
const short = z.string().max(500);
export const snapshotSchema = z.object({
  title: z.string().max(300), slug: z.string().max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$|^$/),
  authorId: z.union([id, z.literal('')]), categoryIds: z.array(id).max(20), primaryCategoryId: z.union([id, z.literal('')]), tagIds: z.array(id).max(50),
  coverId: z.union([id, z.literal('')]), thumbnailId: z.union([id, z.literal('')]), showCover: z.boolean(), excerpt: short,
  featured: z.boolean(), relatedIds: z.array(id).max(3), content: z.record(z.string(), z.unknown()),
  seo: z.object({title: z.string().max(300), description: short, focusKeyword: z.string().max(150), index: z.boolean(), nofollow: z.boolean(), noimageindex: z.boolean(), nosnippet: z.boolean()}),
  social: z.object({title: z.string().max(300), description: short, imageId: z.union([id,z.literal('')]), alt: short, twitterTitle: z.string().max(300), twitterDescription: short, twitterImageId: z.union([id,z.literal('')]), twitterAlt: short}),
  extraJsonLd: z.string().max(30000), extraMeta: z.array(z.object({name: z.string().max(100), content: z.string().max(1000)})).max(15),
}).strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export type PublicationIssue = {field:string;message:string};
export class EditorialValidationError extends Error {
  constructor(public issues:PublicationIssue[],public code='EDITORIAL_PENDING') {super(issues[0]?.message||'Revise as pendências antes de publicar.');this.name='EditorialValidationError';}
}
export class AdvancedValidationError extends Error {
  constructor(message:string,public field='extraJsonLd') {super(message);this.name='AdvancedValidationError';}
}
export type Taxonomy = {id:string; kind:'category'|'tag'|'author'; name:string; slug:string; description:string; image_id?:string|null};
export type Asset = {id:string; alt:string; caption:string; credit:string; copyright:string; status:string; original_path:string; variants:{path:string;width:number;height:number;format:string}[]; width:number; height:number; is_demo?:boolean; public_ready_stamp?:string|null};
export type PublicPost = {id:string; slug:string; snapshot:Snapshot; first_published_at:string; published_at:string; is_demo:boolean; search_text?:string; media?:Asset[]};
export const emptySnapshot = ():Snapshot => ({title:'',slug:'',authorId:'',categoryIds:[],primaryCategoryId:'',tagIds:[],coverId:'',thumbnailId:'',showCover:true,excerpt:'',featured:false,relatedIds:[],content:{type:'doc',content:[{type:'paragraph'}]},seo:{title:'',description:'',focusKeyword:'',index:true,nofollow:false,noimageindex:false,nosnippet:false},social:{title:'',description:'',imageId:'',alt:'',twitterTitle:'',twitterDescription:'',twitterImageId:'',twitterAlt:''},extraJsonLd:'',extraMeta:[]});
export function contentText(node:any):string { return [node.text || '',...(node.content||[]).map(contentText)].join(' ').trim(); }
export function assetIds(s:Snapshot):string[] {
  const ids = [s.coverId,s.thumbnailId,s.social.imageId,s.social.twitterImageId];
  const visit=(n:any)=>{if(n.type==='image' && n.attrs?.assetId) ids.push(n.attrs.assetId); (n.content||[]).forEach(visit);};visit(s.content);
  return [...new Set(ids.filter(Boolean))];
}
export function recommendations(s:Snapshot):string[] {
  const notes:string[]=[];
  if(!s.coverId)notes.push('Selecione uma capa.');
  if(s.seo.focusKeyword && !`${s.title} ${contentText(s.content)}`.toLocaleLowerCase('pt-BR').includes(s.seo.focusKeyword.toLocaleLowerCase('pt-BR')))notes.push('A palavra-chave de foco não aparece no título ou no conteúdo.');
  return notes;
}
export function assetField(s:Snapshot,id:string) {
  return s.coverId===id?'coverId':s.thumbnailId===id?'thumbnailId':s.social.imageId===id?'social.imageId':s.social.twitterImageId===id?'social.twitterImageId':'content';
}
export function publicationIssues(s:Snapshot,assets?:Asset[]):PublicationIssue[] {
  const issues:PublicationIssue[]=[];
  if(!s.title.trim())issues.push({field:'title',message:'Informe o título do artigo.'});
  if(!s.slug)issues.push({field:'slug',message:'Informe o endereço do artigo.'});
  else if(['busca','categoria','tag','autor'].includes(s.slug))issues.push({field:'slug',message:'Este endereço está reservado. Escolha outro slug.'});
  if(!s.authorId)issues.push({field:'authorId',message:'Selecione a autoria do artigo.'});
  if(!s.primaryCategoryId)issues.push({field:'primaryCategoryId',message:'Selecione a categoria principal.'});
  else if(!s.categoryIds.includes(s.primaryCategoryId))issues.push({field:'categoryIds',message:'Inclua nas categorias do artigo a categoria principal já escolhida.'});
  if(!contentText(s.content))issues.push({field:'content',message:'Escreva o conteúdo do artigo.'});
  if(!s.seo.description.trim()&&!s.excerpt.trim())issues.push({field:'seo.description',message:'Adicione uma meta description ou um trecho na aba Geral.'});
  try{validateDocument(s.content);}catch(e){issues.push({field:'content',message:(e as Error).message});}
  try{validateAdvanced(s);}catch(e){issues.push({field:e instanceof AdvancedValidationError?e.field:'extraJsonLd',message:(e as Error).message});}
  if(assets)for(const id of assetIds(s)){
    const a=assets.find(a=>a.id===id),field=assetField(s,id);
    if(!a)issues.push({field,message:'Uma imagem selecionada não está na biblioteca. Selecione-a novamente.'});
    else if(!a.alt.trim())issues.push({field,message:'Preencha o texto alternativo da imagem na Biblioteca de mídia.'});
    else if(!['ready','published'].includes(a.status)||!a.variants.length)issues.push({field,message:'Uma imagem ainda não está pronta. Confira o processamento na Biblioteca de mídia.'});
  }
  return issues;
}
export const checklist=(s:Snapshot,assets:Asset[]=[])=>[...publicationIssues(s,assets).map(i=>i.message),...recommendations(s)];
export function validateExtraMeta(s:Pick<Snapshot,'extraMeta'>) {
  const blocked = /^(?:title$|canonical$|theme-color$|description|robots|keywords|viewport|charset|http-equiv|refresh|og:|twitter:|google-site-verification|content-security-policy)/i;
  const names=new Set<string>();
  for(const m of s.extraMeta){if(!/^[a-z][a-z0-9_.:-]*$/i.test(m.name)||blocked.test(m.name)||names.has(m.name.toLowerCase()))throw new AdvancedValidationError('Metatag duplicada ou não permitida. Revise as metatags adicionais.','extraMeta');names.add(m.name.toLowerCase());}
}
export function validateAdvanced(s:Snapshot) {
  validateExtraMeta(s);
  if(!s.extraJsonLd.trim())return [];
  let parsed:any;
  try{parsed=JSON.parse(s.extraJsonLd);}catch(e){const where=(e as Error).message.match(/line (\d+) column (\d+)/);throw new AdvancedValidationError(`JSON-LD inválido${where?` na linha ${where[1]}, coluna ${where[2]}`:''}. Confira as aspas duplas, vírgulas e chaves. O rascunho pode ser salvo; corrija antes de publicar.`);}
  if(!parsed||typeof parsed!=='object')throw new AdvancedValidationError('JSON-LD deve ser um objeto ou uma lista de objetos.');
  const nodes=Array.isArray(parsed)?parsed:parsed['@graph']||[parsed];
  if(!Array.isArray(nodes)||nodes.length>20)throw new AdvancedValidationError('JSON-LD complementar inválido. Use até 20 objetos.');
  const validType=(t:unknown)=>typeof t==='string'&&t.trim().length>0;
  if(nodes.some(n=>!n||typeof n!=='object'||Array.isArray(n)||!(validType(n['@type'])||Array.isArray(n['@type'])&&n['@type'].length>0&&n['@type'].every(validType))))throw new AdvancedValidationError('Cada objeto JSON-LD precisa informar um @type.');
  const walk=(n:any,depth=0)=>{
    if(depth>16)throw new AdvancedValidationError('JSON-LD excedeu a profundidade permitida.');
    if(typeof n==='string' && /<\/?(?:script|iframe|object)|javascript:|data:text\/html/i.test(n))throw new AdvancedValidationError('Código executável não é permitido no JSON-LD.');
    if(n&&typeof n==='object'){
      const protectedType=['BlogPosting','Article','NewsArticle','WebPage','WebSite','Organization','Person','BreadcrumbList'].find(t=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes(t));
      if(protectedType)throw new AdvancedValidationError(`O tipo ${protectedType} já é gerado automaticamente pelo site. Remova esse bloco do JSON-LD complementar antes de publicar.`);
      if(n['@id'])throw new AdvancedValidationError('Remova o campo @id do JSON-LD complementar. Ele não pode redefinir identificadores da marcação automática.');
      Object.values(n).forEach(v=>walk(v,depth+1));
    }
  };nodes.forEach(n=>walk(n));return nodes;
}
export function validateDocument(doc:any) {
  if(doc?.type!=='doc')throw new Error('O conteúdo precisa ser um documento.');
  const types=new Set(['doc','paragraph','heading','text','bulletList','orderedList','listItem','blockquote','horizontalRule','hardBreak','image','table','tableRow','tableCell','tableHeader']);let count=0;
  const visit=(n:any,depth=0)=>{if(++count>20000||depth>24||!types.has(n?.type))throw new Error('Estrutura do conteúdo inválida.');if(n.type==='heading'&&![2,3].includes(n.attrs?.level))throw new Error('Use subtítulos H2 ou H3.');if(n.type==='image'&&!id.safeParse(n.attrs?.assetId).success)throw new Error('Selecione uma imagem da biblioteca.');if(n.marks?.some((m:any)=>!['bold','italic','underline','strike','code','link'].includes(m.type)))throw new Error('Formatação não permitida.');(n.content||[]).forEach((c:any)=>visit(c,depth+1));};visit(doc);
}
export function validatePublication(s:Snapshot) {
  snapshotSchema.parse(s);
  const issues=publicationIssues(s);if(issues.length)throw new EditorialValidationError(issues,issues.every(i=>i.field==='extraJsonLd')?'INVALID_JSON_LD':'EDITORIAL_PENDING');
}
