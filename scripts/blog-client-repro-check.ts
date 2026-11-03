/** Replay the reported publication failure using a disposable copy of the actual revision and image bytes. */
import {chromium,webkit,expect,type Page,type Browser} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assetIds,contentText,publicationIssues,type Asset,type Snapshot} from '../src/lib/blog/model';

const base='https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev';
const sourceId='03e0df1a-f21a-4265-9468-050f87821f61',sourceVersion=34;
if(process.env.BLOG_TEST_BASE!==base||process.env.BLOG_TEST_PROJECT_REF!=='whttbjpxlxdbwiptvkbs'||process.env.BLOG_INTEGRATION_CONFIRMED!=='true'||process.env.SUPABASE_URL!=='https://whttbjpxlxdbwiptvkbs.supabase.co')throw Error('Only the approved Instituto test project/preview can be used.');
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const output='artifacts/blog-client-repro';await mkdir(output,{recursive:true});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const report:any={startedAt:new Date().toISOString(),base,sourceId,sourceVersion,engines:[],cleanup:[],preserved:false};
const originalRevision=await db.from('blog_revisions').select('snapshot').eq('post_id',sourceId).eq('version',sourceVersion).single();if(originalRevision.error)throw originalRevision.error;
const source=originalRevision.data.snapshot as Snapshot;
assert(source.primaryCategoryId&&!source.categoryIds.includes(source.primaryCategoryId),'The historical failure must be reproduced faithfully, without modifying the original.');
assert.deepEqual(publicationIssues(source).map(i=>i.field),['categoryIds']);
const originalAssets:Asset[]=[];const originals=new Map<string,Buffer>();
for(const id of assetIds(source)){
 const row=await db.from('blog_media').select('*').eq('id',id).single();if(row.error)throw row.error;originalAssets.push(row.data);
 const download=await db.storage.from('blog-private').download(row.data.original_path);if(download.error)throw download.error;originals.set(id,Buffer.from(await download.data.arrayBuffer()));
}
assert(originalAssets.length>0,'The reported article must contain its real image.');
async function protectedFingerprint(){
 const post=await db.from('blog_posts').select('*').eq('id',sourceId).single();if(post.error)throw post.error;
 const revisions=await db.from('blog_revisions').select('*').eq('post_id',sourceId).order('version');if(revisions.error)throw revisions.error;
 const media=await db.from('blog_media').select('*').in('id',originalAssets.map(a=>a.id)).order('id');if(media.error)throw media.error;
 return {post:hash(post.data),revisions:hash(revisions.data),media:hash(media.data),revisionCount:revisions.data.length};
}
const before=await protectedFingerprint();report.before=before;
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true});
async function save(page:Page){await page.locator('[data-save]').click();await expect(page.locator('#save-status')).toHaveText('Salvo',{timeout:20000});}

try{
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]as const){
  console.log('Reproduzindo o artigo e a imagem reais em sessão nova: '+name);
  const marker=randomUUID(),email=`bicalho-repro-${marker}@example.invalid`,password=randomBytes(24).toString('base64url');
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;const actor=created.data.user.id;
  const ownPosts=new Set<string>(),ownMedia=new Set<string>();let browser:Browser|undefined;let page:Page|undefined;
  const result:any={engine:name,sourceImageCount:originalAssets.length,requests:[],checks:[],pageErrors:[],consoleErrors:[]};report.engines.push(result);
  try{
   const member=await db.from('blog_members').insert({user_id:actor,role:'editor'});if(member.error)throw member.error;
   browser=await engine.launch(name==='chromium'?{channel:'chrome'}:{});const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});page=await context.newPage();
   page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
   page.on('response',async response=>{try{const url=new URL(response.url());if(url.origin!==base||!url.pathname.startsWith('/api/blog/')||response.request().method()!=='POST')return;result.requests.push({action:url.pathname.split('/').filter(Boolean).at(-1),status:response.status()});if(url.pathname==='/api/blog/upload/'&&response.ok()){const data=await response.json();ownMedia.add(data.asset.id);}}catch{}});
   await page.goto(base+'/admin/');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await button(page,'Entrar').click();await button(page,'Nova publicação').waitFor();
   const copies=new Map<string,string>();
   for(const asset of originalAssets){
    await page.locator('.admin-nav').getByRole('button',{name:'Biblioteca de mídia',exact:true}).click();await button(page,'Enviar imagem').click();
    const ext=asset.original_path.split('.').at(-1)!.toLowerCase(),type=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif'}as Record<string,string>)[ext];assert(type);
    await page.locator('#media-form input[type=file]').setInputFiles({name:`repro-${marker}.${ext}`,mimeType:type,buffer:originals.get(asset.id)!});
    for(const [label,value]of [['Texto alternativo',asset.alt],['Legenda',asset.caption],['Crédito',asset.credit],['Direitos autorais',asset.copyright]])await page.getByLabel(label,{exact:true}).fill(value);
    const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/blog/upload/')&&r.request().method()==='POST'&&r.ok());
    await button(page,'Enviar e otimizar').click();const upload=await (await uploaded).json();ownMedia.add(upload.asset.id);copies.set(asset.id,upload.asset.id);
    await expect(page.locator('#admin-dialog')).not.toBeVisible({timeout:90000});
    const ready=await db.from('blog_media').select('*').eq('id',upload.asset.id).single();if(ready.error)throw ready.error;assert.equal(ready.data.status,'ready');assert.equal(ready.data.width,asset.width);assert.equal(ready.data.height,asset.height);
    const bytes=await db.storage.from('blog-private').download(ready.data.original_path);if(bytes.error)throw bytes.error;assert.equal(createHash('sha256').update(Buffer.from(await bytes.data.arrayBuffer())).digest('hex'),createHash('sha256').update(originals.get(asset.id)!).digest('hex'));
    result.checks.push({step:'Original real reenviado pela interface, bytes idênticos e versões prontas',width:ready.data.width,height:ready.data.height,variants:ready.data.variants.length});
   }
   // Only disposable media identifiers and the temporary URL differ from the failed revision.
   let serialized=JSON.stringify(source);for(const [oldId,newId]of copies)serialized=serialized.replaceAll(oldId,newId);
   const copy=JSON.parse(serialized)as Snapshot;copy.slug=`teste-descartavel-repro-${marker}`;
   assert.equal(contentText(copy.content),contentText(source.content));
   const savedResponse=await context.request.post(base+'/api/blog/save/',{headers:{Origin:base},data:{snapshot:copy,version:0}});assert.equal(savedResponse.status(),200);const saved=await savedResponse.json();ownPosts.add(saved.id);
   const demo=await db.from('blog_posts').update({is_demo:true}).eq('id',saved.id).eq('created_by',actor);if(demo.error)throw demo.error;
   await page.reload();await page.locator(`[data-open="${saved.id}"]`).click();
   await expect(page.locator('#publication-pending')).toContainText('categoria principal já escolhida');
   const prepareCount=result.requests.filter((r:any)=>r.action==='prepare-media').length;
   await page.locator('[data-publish]').click();await expect(page.locator('[data-validation-field="categoryIds"]')).toBeFocused();
   assert.equal(result.requests.filter((r:any)=>r.action==='prepare-media').length,prepareCount);await expect(page.locator('#admin-status')).not.toContainText('Não foi possível concluir');
   await page.screenshot({path:`${output}/categoria-pendente-${name}.png`,fullPage:false});
   // Re-run the very endpoint shown in the client's console, using this copy/revision.
   const failedProbe=await context.request.post(base+'/api/blog/prepare-media/',{headers:{Origin:base},data:{id:saved.id,version:saved.version,assetId:[...copies.values()][0]}});assert.equal(failedProbe.status(),422);const issue=await failedProbe.json();assert(issue.fields.includes('categoryIds'));assert(issue.issues.some((i:any)=>i.message.includes('categoria principal')));result.checks.push({step:'Mesma categoria inconsistente e mesmo endpoint do erro original',uiStopsBeforeMedia:true,apiStatus:failedProbe.status(),code:issue.code,fields:issue.fields,requestId:issue.requestId});
   await page.locator(`[data-category-id="${copy.primaryCategoryId}"]`).check();await save(page);
   await page.locator('[data-publish]').click();await expect(page.locator('#admin-status')).toContainText('Publicação atualizada',{timeout:90000});
   const live=await db.from('blog_publications').select('*').eq('id',saved.id).single();if(live.error)throw live.error;assert.equal(live.data.snapshot.title,source.title);assert.equal(contentText(live.data.snapshot.content),contentText(source.content));assert(live.data.snapshot.categoryIds.includes(copy.primaryCategoryId));
   const article=await context.newPage();await article.goto(base+`/conteudos/${copy.slug}/?repro=${marker}`);await expect(article.locator('.article-opening h1')).toHaveText(source.title);await expect(article.locator('.article-prose')).toContainText(contentText(source.content).replace(/\s+/g,' ').trim().slice(0,160));
   for(const image of await article.locator('.article-prose img').all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);}
   await page.screenshot({path:`${output}/publicacao-concluida-${name}.png`,fullPage:false});await article.screenshot({path:`${output}/artigo-publicado-${name}.png`,fullPage:true});await article.close();
   result.checks.push({step:'Corrigido somente o vínculo da categoria, publicação concluída com texto e imagem reais',published:true});
   // Replay the other two classes of error present in the reported logs, preserving the live revision.
   for(const [kind,json]of [['sintaxe','{"@type":'],['duplicado','{"@type":"BlogPosting"}']]){
    await page.locator('[data-tab="advanced"]').click();await page.locator('[data-field="extraJsonLd"]').fill(json);await save(page);const row=await db.from('blog_posts').select('version,draft').eq('id',saved.id).single();if(row.error)throw row.error;assert.equal(row.data.draft.extraJsonLd,json);
    await page.reload();await page.locator(`[data-open="${saved.id}"]`).click();await page.locator('[data-tab="advanced"]').click();await expect(page.locator('[data-field="extraJsonLd"]')).toHaveValue(json);
    const previousRequests=result.requests.filter((r:any)=>r.action==='prepare-media').length;
    await page.locator('[data-publish]').click();await expect(page.locator('[data-field="extraJsonLd"]')).toBeFocused();await expect(page.locator('#publication-pending')).toContainText(kind==='sintaxe'?'JSON-LD inválido':'BlogPosting já é gerado');assert.equal(result.requests.filter((r:any)=>r.action==='prepare-media').length,previousRequests);
    const preview=await context.request.get(base+`/conteudos/previa/${saved.id}/`);assert.equal(preview.status(),200);assert((await preview.text()).includes('omitido desta prévia'));
    const publicRevision=await db.from('blog_publications').select('revision_id').eq('id',saved.id).single();assert.equal(publicRevision.data?.revision_id,live.data.revision_id);
    result.checks.push({step:`JSON-LD ${kind}: salvo/reaberto, pendência específica, prévia segura e versão pública preservada`});
   }
   await page.locator('[data-field="extraJsonLd"]').fill(source.extraJsonLd);await save(page);await page.locator('[data-publish]').click();await expect(page.locator('#admin-status')).toContainText('Publicação atualizada',{timeout:90000});
   assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.consoleErrors,[]);assert.equal(result.requests.filter((r:any)=>r.status>=400).length,0,'The normal UI flow must not repeat HTTP 400 or any other failing request');assert(result.requests.some((r:any)=>r.action==='prepare-media'&&r.status===200));assert.equal(result.requests.filter((r:any)=>r.action==='publish'&&r.status===200).length,2);
   result.passed=true;console.log('PASS: '+name+' — original reenviado, pendência clara, publicação e atualização 200, nenhum erro no console.');
  }catch(error){result.failure=(error as Error).message;if(page)await page.screenshot({path:`${output}/failure-${name}.png`,fullPage:true}).catch(()=>{});throw error;}
  finally{
   if(browser)await browser.close();
   const rows=await db.from('blog_posts').select('id').eq('created_by',actor);if(rows.error)throw rows.error;for(const row of rows.data)ownPosts.add(row.id);
   const images=await db.from('blog_media').select('*').eq('created_by',actor);if(images.error)throw images.error;for(const row of images.data)ownMedia.add(row.id);
   for(const id of ownPosts){assert(id!==sourceId);const removed=await db.from('blog_posts').delete().eq('id',id).eq('created_by',actor);if(removed.error)throw removed.error;}
   for(const id of ownMedia){assert(!originalAssets.some(a=>a.id===id));const asset=images.data.find(a=>a.id===id);if(!asset)continue;for(const bucket of ['blog-private','blog-public']){const paths=[...(bucket==='blog-private'?[asset.original_path]:[]),...asset.variants.map((v:any)=>v.path)];if(paths.length){const r=await db.storage.from(bucket).remove(paths);if(r.error)throw r.error;}}const removed=await db.from('blog_media').delete().eq('id',id).eq('created_by',actor);if(removed.error)throw removed.error;}
   const removed=await db.auth.admin.deleteUser(actor);if(removed.error)throw removed.error;report.cleanup.push({engine:name,posts:ownPosts.size,images:ownMedia.size,account:true});await writeFile(output+'/report.json',JSON.stringify(report,null,2));
  }
 }
 const after=await protectedFingerprint();report.after=after;assert.deepEqual(after,before,'The original post, every revision and original media metadata must remain unchanged');report.preserved=true;report.completedAt=new Date().toISOString();console.log('PASS: artigo original, '+after.revisionCount+' revisões e mídia original preservados integralmente.');
}catch(error){report.failure=(error as Error).message;throw error;}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
