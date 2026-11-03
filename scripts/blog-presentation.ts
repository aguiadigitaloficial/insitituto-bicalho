/** Refresh only the twelve original preview samples, preserving all client data. */
import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {presentationArticles,presentationSnapshot} from './fixtures/blog-presentation';
import {assetIds,contentText,slugify,validatePublication} from '../src/lib/blog/model';

const ref='whttbjpxlxdbwiptvkbs',base='https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev';
if(process.env.BLOG_TEST_PROJECT_REF!==ref||process.env.SUPABASE_URL!==`https://${ref}.supabase.co`||process.env.BLOG_TEST_BASE!==base||process.env.BLOG_DEMO!=='true'||process.env.BLOG_ENVIRONMENT!=='preview')throw Error('Use somente o projeto e a prévia confirmados do Instituto.');
const actor=process.env.BLOG_SEED_ACTOR!;assert(actor);
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const dir='artifacts/blog-presentation-20261103';await mkdir(dir,{recursive:true});
const digest=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const legacyMediaDigest=(variants:any[])=>digest(variants.map(({path,width,height,format})=>({path,width,height,format})));
function readyStampKnown(asset:any){assert([digest(asset.variants),legacyMediaDigest(asset.variants)].includes(asset.public_ready_stamp),'A mídia mudou; prepare-a novamente antes de continuar.');}
const [postResult,taxResult,mediaResult,publicResult,member,user]=await Promise.all([
 db.from('blog_posts').select('*'),db.from('blog_taxonomies').select('*'),db.from('blog_media').select('*'),db.from('blog_publications').select('*'),
 db.from('blog_members').select('role').eq('user_id',actor).single(),db.auth.admin.getUserById(actor),
]);
for(const r of [postResult,taxResult,mediaResult,publicResult,member,user])if(r.error)throw r.error;
assert.equal(member.data!.role,'owner');assert.equal(user.data.user?.email,'institutobicalho.site@outlook.com');
const posts=postResult.data!,tax=taxResult.data!,media=mediaResult.data!,publications=publicResult.data!;
const samples=presentationArticles.map((article,index)=>{
 const matches=posts.filter(p=>p.is_demo&&!p.trashed_at&&[`demonstracao-editorial-${index+1}`,article.slug].includes(p.draft.slug));
 assert.equal(matches.length,1,`Confirme a demonstração ${index+1}; nenhuma publicação do cliente será substituída.`);
 assert(publications.some(p=>p.id===matches[0].id&&p.is_demo));
 assert(!publications.some(p=>p.slug===article.slug&&p.id!==matches[0].id));
 return matches[0];
});
const author=tax.find(t=>t.kind==='author'&&t.slug==='instituto-bicalho');assert(author);
const ownerRows=posts.filter(p=>p.created_by===actor&&!p.is_demo).map(p=>({id:p.id,version:p.version,draft:p.draft,trashed_at:p.trashed_at}));
const beforeOwnerDigest=digest(ownerRows);
const tagNames=[...new Set(presentationArticles.flatMap(a=>[...a.tags]))];
const placeholderId='00000000-0000-4000-8000-000000000001';
function snapshot(index:number,taxonomies=tax){
 const a=presentationArticles[index],p=samples[index],cover=media.find(m=>m.id===p.draft.coverId);assert(cover&&cover.is_demo&&cover.status==='published');
 readyStampKnown(cover);
 const category=taxonomies.find(t=>t.kind==='category'&&t.slug===a.category);assert(category);
 const related=samples.filter((_,i)=>i!==index&&presentationArticles[i].category===a.category).concat(samples.filter((_,i)=>i!==index&&presentationArticles[i].category!==a.category)).slice(0,3).map(p=>p.id);
 const inlineIndexes=[1,2,-1,10,-1,8,3,9,5,-1,3,5];
 const s=presentationSnapshot(index,{author:author.id,category:category.id,tags:a.tags.map(name=>taxonomies.find(t=>t.kind==='tag'&&t.name===name)?.id||placeholderId),cover:cover.id,inline:inlineIndexes[index]<0?'':samples[inlineIndexes[index]].draft.coverId,thumbnail:samples[5].draft.coverId,related});
 s.social.alt=cover.alt;validatePublication(s);return s;
}
const proposed=presentationArticles.map((a,i)=>({oldSlug:publications.find(p=>p.id===samples[i].id)!.slug,slug:a.slug,title:a.title,category:a.category,featured:a.featured,words:contentText(snapshot(i).content).split(/\s+/).length}));
await writeFile(`${dir}/proposed.json`,JSON.stringify(proposed,null,2));
if(!process.argv.includes('--apply')){console.log(JSON.stringify({dryRun:true,samples:proposed,ownerDraftsPreserved:ownerRows.length,tags:tagNames},null,2));process.exit(0);}

await writeFile(`${dir}/before-${Date.now()}.json`,JSON.stringify({posts:samples,publications:publications.filter(p=>samples.some(s=>s.id===p.id)),media:media.filter(m=>samples.some(s=>assetIds(s.draft).includes(m.id))),taxonomies:tax,ownerDraftDigest:beforeOwnerDigest},null,2),{mode:0o600});
for(const name of tagNames){
 if(tax.some(t=>t.kind==='tag'&&t.name===name))continue;
 const inserted=await db.from('blog_taxonomies').insert({kind:'tag',name,slug:slugify(name),description:`Publicações institucionais sobre ${name.toLocaleLowerCase('pt-BR')}.`}).select().single();
 if(inserted.error)throw inserted.error;tax.push(inserted.data);
}
const changed=[];
for(let index=0;index<samples.length;index++){
 const post=samples[index],s=snapshot(index);
 const assets=assetIds(s).map(id=>{const a=media.find(m=>m.id===id);assert(a&&a.is_demo&&a.variants.length);readyStampKnown(a);return a;});
 for(const a of assets){
  // The original seed stamped key order before JSONB normalized it. Confirm every
  // published file before normalizing that legacy stamp; no pixels are regenerated.
  if(a.public_ready_stamp!==digest(a.variants)){
   for(let start=0;start<a.variants.length;start+=4)await Promise.all(a.variants.slice(start,start+4).map(async(v:any)=>{const url=db.storage.from('blog-public').getPublicUrl(v.path).data.publicUrl;const response=await fetch(url,{method:'HEAD'});assert(response.ok,`Imagem pública indisponível: ${v.path}`);}));
   const stamp=digest(a.variants);const normalized=await db.from('blog_media').update({public_ready_stamp:stamp}).eq('id',a.id).eq('is_demo',true).eq('public_ready_stamp',a.public_ready_stamp);if(normalized.error)throw normalized.error;a.public_ready_stamp=stamp;
  }
  // A client draft may reuse an image; its library metadata must stay untouched.
  const shared=posts.some(p=>!p.is_demo&&assetIds(p.draft).includes(a.id));
  if(!shared&&a.caption!==a.alt){const updated=await db.from('blog_media').update({caption:a.alt}).eq('id',a.id).eq('is_demo',true);if(updated.error)throw updated.error;a.caption=a.alt;}
 }
 const publishedMedia=assets.map(({id,alt,credit,copyright,variants,width,height})=>({id,alt,caption:alt,credit,copyright,variants,width,height,status:'published'}));
 if(isDeepStrictEqual(post.draft,s)){changed.push({id:post.id,slug:s.slug,unchanged:true});continue;}
 const saved=await db.rpc('blog_save',{p_id:post.id,p_snapshot:s,p_version:post.version,p_actor:actor});if(saved.error)throw saved.error;
 assert(saved.data.is_demo);const revision=await db.from('blog_revisions').select('id').eq('post_id',post.id).eq('version',saved.data.version).single();if(revision.error)throw revision.error;
 const published=await db.rpc('blog_publish',{p_id:post.id,p_revision:revision.data.id,p_search:`${s.title} ${s.excerpt} ${contentText(s.content)}`,p_media:publishedMedia});if(published.error)throw published.error;
 changed.push({id:post.id,slug:published.data,title:s.title,version:saved.data.version});console.log(`Preparado: ${s.title}`);
}
const ownerAfter=await db.from('blog_posts').select('*').eq('created_by',actor).eq('is_demo',false);if(ownerAfter.error)throw ownerAfter.error;
assert.equal(digest(ownerAfter.data!.map(p=>({id:p.id,version:p.version,draft:p.draft,trashed_at:p.trashed_at}))),beforeOwnerDigest,'O rascunho do proprietário precisa permanecer intacto.');
let presentationDraft=posts.find(p=>p.is_demo&&p.draft.slug==='rascunho-apresentacao-avaliacao');
if(!presentationDraft){
 const s=snapshot(0);s.title='Converse com a equipe sobre sua avaliação';s.slug='rascunho-apresentacao-avaliacao';s.featured=false;s.seo.title=s.title+' | Instituto Bicalho';s.social.title=s.title;
 const saved=await db.rpc('blog_save',{p_id:null,p_snapshot:s,p_version:0,p_actor:actor});if(saved.error)throw saved.error;
 const marked=await db.from('blog_posts').update({is_demo:true}).eq('id',saved.data.id).eq('created_by',actor).select().single();if(marked.error)throw marked.error;presentationDraft=marked.data;
}
assert(!publications.some(p=>p.id===presentationDraft!.id));
const report={updatedAt:new Date().toISOString(),preview:base,projectRef:ref,samples:changed,presentationDraft:{id:presentationDraft.id,title:presentationDraft.draft.title,slug:presentationDraft.draft.slug},ownerDraftsPreserved:ownerRows.length,ownerDraftDigest:beforeOwnerDigest,allSamplesRemainDemo:true,clinicianAuthorshipInvented:false,originalRevisionsRetained:true};
await writeFile(`${dir}/refresh.json`,JSON.stringify(report,null,2));console.log(`PASS: ${changed.length} exemplos preparados; ${ownerRows.length} rascunho do proprietário preservado.`);
