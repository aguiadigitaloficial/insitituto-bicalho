import type { APIRoute } from 'astro';
import { nav, site } from '../data/content';
import { legalPages } from '../data/legal';
import {publicData,publicCache} from '../lib/blog/server';
import { sitemapEntries, sitemapXml } from '../lib/blog/sitemap';
export const prerender=false;
export const GET: APIRoute = async () => {
 try{
 const {posts,taxonomies}=await publicData();
 const entries=sitemapEntries({siteUrl:site.url,staticPaths:[...nav.map(n=>n.href),...legalPages.map(p=>`/${p.slug}/`)],posts,taxonomies});
 return new Response(sitemapXml(entries),{headers:{...publicCache(),'Content-Type':'application/xml; charset=utf-8'}});
 }catch{return new Response('Sitemap temporariamente indisponível.',{status:503,headers:{'Cache-Control':'no-store'}});}
};
