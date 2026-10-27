import type { APIRoute } from 'astro';
import { nav, site } from '../data/content';
import { legalPages } from '../data/legal';
import {publicData,publicCache} from '../lib/blog/server';
export const prerender=false;
const xml=(s:string)=>s.replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]!));
export const GET: APIRoute = async () => {
 try{
 const {posts,taxonomies}=await publicData();
 const eligible=posts.filter(p=>!p.is_demo&&p.snapshot.seo.index);
 const entries=[...nav.map(n=>({path:n.href,date:''})),...legalPages.map(p=>({path:`/${p.slug}/`,date:''})),...eligible.map(p=>({path:`/conteudos/${p.slug}/`,date:p.published_at})),...taxonomies.filter(t=>t.kind!=='tag'&&eligible.some(p=>t.kind==='author'?p.snapshot.authorId===t.id:p.snapshot.categoryIds.includes(t.id))).map(t=>({path:`/conteudos/${t.kind==='author'?'autor':'categoria'}/${t.slug}/`,date:''}))];
 return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(e=>`<url><loc>${xml(new URL(e.path,site.url).href)}</loc>${e.date?`<lastmod>${xml(e.date)}</lastmod>`:''}</url>`).join('')}</urlset>`,{headers:{...publicCache(),'Content-Type':'application/xml'}});
 }catch{return new Response('Sitemap temporariamente indisponível.',{status:503,headers:{'Cache-Control':'no-store'}});}
};
