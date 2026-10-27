import sanitize from 'sanitize-html';
import { slugify, type Asset } from './model';
export const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function safeUrl(s:string){try {const u=new URL(s,'https://institutobicalho.com');return ['https:','http:','mailto:','tel:'].includes(u.protocol)?s:'#';}catch{return '#';}}
export function renderDocument(doc:any,assets:Asset[],url:(a:Asset,width?:number)=>string) {
  const toc:{id:string;text:string;level:number}[]=[]; const used=new Map<string,number>();
  const render=(n:any):string=>{
    const inner=()=> (n.content||[]).map(render).join('');
    if(n.type==='text') {let t=escapeHtml(n.text);for(const m of n.marks||[]){const tags:Record<string,string>={bold:'strong',italic:'em',underline:'u',strike:'s',code:'code'};if(tags[m.type])t=`<${tags[m.type]}>${t}</${tags[m.type]}>`;if(m.type==='link')t=`<a href="${escapeHtml(safeUrl(m.attrs?.href||''))}" rel="noopener noreferrer">${t}</a>`;}return t;}
    if(n.type==='heading'){const text=(n.content||[]).map((c:any)=>c.text||'').join('');const root=slugify(text)||'secao';const times=(used.get(root)||0)+1;used.set(root,times);const id=times===1?root:`${root}-${times}`;const level=n.attrs?.level===3?3:2;toc.push({id,text,level});return `<h${level} id="${id}">${inner()}</h${level}>`;}
    if(n.type==='image'){const a=assets.find(a=>a.id===n.attrs?.assetId);if(!a)return '';const srcset=a.variants.filter(v=>v.format==='webp').map(v=>`${escapeHtml(url(a,v.width))} ${v.width}w`).join(', ');return `<figure><img src="${escapeHtml(url(a,1600))}" srcset="${srcset}" sizes="(min-width:1200px) 680px, (min-width:600px) calc(100vw - 56px), calc(100vw - 40px)" alt="${escapeHtml(a.alt)}" width="${a.width}" height="${a.height}" loading="lazy">${a.caption?`<figcaption>${escapeHtml(a.caption)}</figcaption>`:''}</figure>`;}
    if(n.type==='hardBreak')return '<br>';if(n.type==='horizontalRule')return '<hr>';
    const tags:Record<string,string>={paragraph:'p',bulletList:'ul',orderedList:'ol',listItem:'li',blockquote:'blockquote',table:'table',tableRow:'tr',tableCell:'td',tableHeader:'th'};
    if(n.type==='table')return `<div class="article-table" tabindex="0">${`<table>${inner()}</table>`}</div>`;
    return tags[n.type]?`<${tags[n.type]}>${inner()}</${tags[n.type]}>`:inner();
  };
  const html=sanitize(render(doc),{allowedTags:['p','h2','h3','strong','em','u','s','code','a','ul','ol','li','blockquote','hr','br','figure','img','figcaption','div','table','tr','td','th'],allowedAttributes:{a:['href','rel'],img:['src','srcset','sizes','alt','width','height','loading'],h2:['id'],h3:['id'],div:['class','tabindex']},allowedSchemes:['https','http','mailto','tel']});return {html,toc};
}
