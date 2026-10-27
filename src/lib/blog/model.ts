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
export type Taxonomy = {id:string; kind:'category'|'tag'|'author'; name:string; slug:string; description:string; image_id?:string|null};
export type Asset = {id:string; alt:string; caption:string; credit:string; copyright:string; status:string; original_path:string; variants:{path:string;width:number;height:number;format:string}[]; width:number; height:number; is_demo?:boolean};
export type PublicPost = {id:string; slug:string; snapshot:Snapshot; first_published_at:string; published_at:string; is_demo:boolean; search_text?:string; media?:Asset[]};
export const emptySnapshot = ():Snapshot => ({title:'',slug:'',authorId:'',categoryIds:[],primaryCategoryId:'',tagIds:[],coverId:'',thumbnailId:'',showCover:true,excerpt:'',featured:false,relatedIds:[],content:{type:'doc',content:[{type:'paragraph'}]},seo:{title:'',description:'',focusKeyword:'',index:true,nofollow:false,noimageindex:false,nosnippet:false},social:{title:'',description:'',imageId:'',alt:'',twitterTitle:'',twitterDescription:'',twitterImageId:'',twitterAlt:''},extraJsonLd:'',extraMeta:[]});
export function contentText(node:any):string { return [node.text || '',...(node.content||[]).map(contentText)].join(' ').trim(); }
export function assetIds(s:Snapshot):string[] {
  const ids = [s.coverId,s.thumbnailId,s.social.imageId,s.social.twitterImageId];
  const visit=(n:any)=>{if(n.type==='image' && n.attrs?.assetId) ids.push(n.attrs.assetId); (n.content||[]).forEach(visit);};visit(s.content);
  return [...new Set(ids.filter(Boolean))];
}
export function checklist(s:Snapshot, assets:Asset[]=[]):string[] {
  const notes:string[]=[];
  if(!s.title.trim())notes.push('Informe o título.');
  if(!s.slug)notes.push('Informe o endereço do artigo.');
  if(!s.authorId)notes.push('Selecione a autoria.');
  if(!s.primaryCategoryId || !s.categoryIds.includes(s.primaryCategoryId))notes.push('Selecione a categoria principal.');
  if(!contentText(s.content))notes.push('Escreva o conteúdo.');
  if(!s.seo.description.trim()&&!s.excerpt.trim())notes.push('Adicione uma descrição para a busca ou um trecho.');
  if(!s.coverId)notes.push('Selecione uma capa.');
  for(const a of assets)if(assetIds(s).includes(a.id)&&!a.alt.trim())notes.push('Uma imagem está sem texto alternativo.');
  if(s.seo.focusKeyword && !`${s.title} ${contentText(s.content)}`.toLocaleLowerCase('pt-BR').includes(s.seo.focusKeyword.toLocaleLowerCase('pt-BR')))notes.push('A palavra-chave de foco não aparece no título ou no conteúdo.');
  return notes;
}
export function validateAdvanced(s:Snapshot) {
  const blocked = /^(?:title$|canonical$|theme-color$|description|robots|keywords|viewport|charset|http-equiv|refresh|og:|twitter:|google-site-verification|content-security-policy)/i;
  const names=new Set<string>();
  for(const m of s.extraMeta){if(!/^[a-z][a-z0-9_.:-]*$/i.test(m.name)||blocked.test(m.name)||names.has(m.name.toLowerCase()))throw new Error('Metatag duplicada ou não permitida.');names.add(m.name.toLowerCase());}
  if(!s.extraJsonLd.trim())return [];
  const parsed=JSON.parse(s.extraJsonLd);
  if(!parsed||typeof parsed!=='object')throw new Error('JSON-LD deve ser um objeto ou uma lista de objetos.');
  const nodes=Array.isArray(parsed)?parsed:parsed['@graph']||[parsed];
  if(!Array.isArray(nodes)||nodes.length>20)throw new Error('JSON-LD complementar inválido.');
  const validType=(t:unknown)=>typeof t==='string'&&t.trim().length>0;
  if(nodes.some(n=>!n||typeof n!=='object'||Array.isArray(n)||!(validType(n['@type'])||Array.isArray(n['@type'])&&n['@type'].length>0&&n['@type'].every(validType))))throw new Error('Cada objeto JSON-LD precisa informar um @type.');
  const walk=(n:any,depth=0)=>{
    if(depth>16)throw new Error('JSON-LD excedeu a profundidade permitida.');
    if(typeof n==='string' && /<\/?(?:script|iframe|object)|javascript:|data:text\/html/i.test(n))throw new Error('Código executável não é permitido.');
    if(n&&typeof n==='object'){
      if(['BlogPosting','Article','NewsArticle','WebPage','WebSite','Organization','Person','BreadcrumbList'].some(t=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes(t))||n['@id'])throw new Error('O complemento não pode substituir a marcação principal ou definir identificadores.');
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
  snapshotSchema.parse(s);validateAdvanced(s);validateDocument(s.content);
  if(!s.title.trim()||!s.slug||!s.authorId||!s.primaryCategoryId||!s.categoryIds.includes(s.primaryCategoryId)||!contentText(s.content)||!(s.seo.description||s.excerpt).trim())throw new Error('Preencha título, endereço, autor, categoria principal, conteúdo e descrição antes de publicar.');
  if(['busca','categoria','tag','autor'].includes(s.slug))throw new Error('Este endereço está reservado.');
}
