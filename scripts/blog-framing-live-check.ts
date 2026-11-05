/** Hosted preview integration. Only disposable editors/posts are mutated and removed. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {chromium,webkit,expect,type Browser,type Page,type APIResponse} from '@playwright/test';
import {emptySnapshot,type Snapshot} from '../src/lib/blog/model';

const base=process.env.BLOG_TEST_BASE;
if(base!=='https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev'||process.env.SUPABASE_URL!=='https://whttbjpxlxdbwiptvkbs.supabase.co'||process.env.BLOG_INTEGRATION_CONFIRMED!=='true')throw Error('Only the authorized preview/test database is allowed.');
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const dir='artifacts/blog-framing/live';await mkdir(dir,{recursive:true});
const report:any={at:new Date().toISOString(),base,checks:[],errors:[]};
const actors:string[]=[],posts:string[]=[];let browser:Browser|undefined,page:Page|undefined;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function realState(){const r=await db.from('blog_posts').select('id,draft,version').eq('is_demo',false).order('id');if(r.error)throw r.error;return hash(r.data);}
const before=await realState();
const click=(name:string)=>page!.getByRole('button',{name,exact:true}).click();
try{
 const taxonomy=await db.from('blog_taxonomies').select('*');if(taxonomy.error)throw taxonomy.error;
 const author=taxonomy.data.find(t=>t.kind==='author')!,category=taxonomy.data.find(t=>t.kind==='category')!;
 const media=await db.from('blog_media').select('*').eq('status','published');if(media.error)throw media.error;
 const photo=media.data.find(a=>a.height>a.width&&a.public_ready_stamp);assert(photo,'A ready portrait is required');
 for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']] as const){
  const marker=randomUUID(),email=`bicalho-framing-${marker}@example.invalid`,password=randomBytes(24).toString('base64url');
  const user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;actors.push(user.data.user.id);
  const member=await db.from('blog_members').insert({user_id:user.data.user.id,role:'editor'});if(member.error)throw member.error;
  browser=await engine.launch(name==='chromium'?{channel:'chrome'}:{});
  const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/admin/');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await click('Entrar');await page.getByRole('button',{name:'Nova publicação',exact:true}).waitFor();
  const api=async(action:string,data:any,status=200):Promise<any>=>{const r=await context.request.post(base+`/api/blog/${action}/`,{headers:{Origin:base!},data});const body=await r.json();assert.equal(r.status(),status,`${action}: ${JSON.stringify(body)}`);return body;};
  const s:Snapshot={...emptySnapshot(),title:`Demonstração descartável de enquadramento ${marker.slice(0,8)}`,slug:`demonstracao-enquadramento-${marker}`,authorId:author.id,categoryIds:[category.id],primaryCategoryId:category.id,coverId:photo.id,excerpt:'Artigo descartável para validar os ajustes de imagens.',content:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Enquadramento de demonstração'}]},{type:'paragraph',content:[{type:'text',text:'Conteúdo temporário de verificação do painel.'}]}]},imageFraming:{article:{mode:'cover',x:35,y:12,zoom:1.25},listing:{mode:'contain',x:50,y:50,zoom:1},compact:{mode:'cover',x:80,y:0,zoom:1}}};
  await api('save',{snapshot:{...s,imageFraming:{article:{mode:'cover',x:500,y:0,zoom:1}}},version:0},422);
  let saved=await api('save',{snapshot:s,version:0});posts.push(saved.id);await db.from('blog_posts').update({is_demo:true}).eq('id',saved.id);
  const privatePage=await context.newPage();await privatePage.goto(base+`/conteudos/previa/${saved.id}/`);await expect(privatePage.locator('.article-opening .blog-photo')).toHaveAttribute('data-frame-mode','cover');
  const privateStyle=await privatePage.locator('.article-opening .blog-photo img').getAttribute('style');await privatePage.close();
  await page.reload();await page.locator('.admin-post-row').filter({hasText:s.title}).getByRole('button',{name:'Editar',exact:true}).click();await click('Publicar');await expect(page.locator('#admin-status')).toContainText('Publicação atualizada',{timeout:60000});
  let pub=await db.from('blog_publications').select('*').eq('id',saved.id).single();if(pub.error)throw pub.error;assert.deepEqual(pub.data.snapshot.imageFraming,s.imageFraming);
  const article=await context.newPage();await article.goto(base+`/conteudos/${s.slug}/?check=${marker}`);await expect(article.locator('.article-opening .blog-photo img')).toHaveAttribute('style',privateStyle!);
  const html=await (await context.request.get(base+`/conteudos/${s.slug}/?ssr=${marker}`)).text();assert(html.includes('data-frame-mode="cover"'));assert(html.includes('noindex'));assert(!html.includes('meta keywords'));
  const og=await article.locator('meta[property="og:image"]').getAttribute('content');
  saved=(await db.from('blog_posts').select('*').eq('id',saved.id).single()).data;
  const changed=structuredClone(s);changed.imageFraming!.article={mode:'contain',x:50,y:50,zoom:1};
  const edit=await api('save',{id:saved.id,version:saved.version,snapshot:changed});
  pub=await db.from('blog_publications').select('snapshot').eq('id',saved.id).single();assert.deepEqual(pub.data!.snapshot.imageFraming,s.imageFraming,'Draft framing must not change public images');
  await api('publish',{id:saved.id,version:saved.version},409);
  await api('validate-publication',{id:edit.id,version:edit.version});await api('prepare-media',{id:edit.id,version:edit.version,assetId:photo.id});await api('publish',{id:edit.id,version:edit.version});
  await article.goto(base+`/conteudos/${s.slug}/?updated=${randomUUID()}`);await expect(article.locator('.article-opening .blog-photo')).toHaveAttribute('data-frame-mode','contain');assert.equal(await article.locator('meta[property="og:image"]').getAttribute('content'),og,'Framing must not alter social media');
  const revisions=await (await context.request.get(base+`/api/blog/revisions/?id=${saved.id}`)).json();const original=revisions.find((r:any)=>r.snapshot.imageFraming.article.mode==='cover');assert(original);
  const restored=await api('save',{id:edit.id,version:edit.version,snapshot:original.snapshot});assert.deepEqual(restored.draft.imageFraming,s.imageFraming);
  assert.equal((await db.from('blog_publications').select('snapshot').eq('id',edit.id).single()).data!.snapshot.imageFraming.article.mode,'contain');
  // A second article shares the same media but has its own presentation and schedule.
  const second=await api('save',{version:0,snapshot:{...s,title:s.title+' segundo',slug:s.slug+'-segundo',imageFraming:{article:{mode:'cover',x:50,y:80,zoom:2}}}});posts.push(second.id);await db.from('blog_posts').update({is_demo:true}).eq('id',second.id);
  await api('prepare-media',{id:second.id,version:second.version,assetId:photo.id});await api('schedule',{id:second.id,version:second.version,at:new Date(Date.now()+3600000).toISOString()});
  const scheduled=await db.from('blog_schedules').select('revision_id,status').eq('post_id',second.id).single();assert.equal(scheduled.data!.status,'pending');
  const revision=await db.from('blog_revisions').select('snapshot').eq('id',scheduled.data!.revision_id).single();assert.equal(revision.data!.snapshot.imageFraming.article.zoom,2);await api('cancel-schedule',{id:second.id});
  assert.equal((await db.from('blog_publications').select('snapshot').eq('id',edit.id).single()).data!.snapshot.imageFraming.article.mode,'contain');
  const anonymous=await browser.newContext({javaScriptEnabled:false});const nojs=await anonymous.newPage();await nojs.goto(base+`/conteudos/${s.slug}/?nojs=${marker}`);await expect(nojs.locator('.article-opening .blog-photo')).toHaveAttribute('data-frame-mode','contain');const denied:APIResponse=await anonymous.request.get(base+`/api/blog/media-file/?id=${photo.id}&width=1200`);assert.equal(denied.status(),401);await anonymous.close();
  const large:APIResponse=await context.request.get(base+`/api/blog/media-file/?id=${photo.id}&width=1200`,{maxRedirects:0});assert.equal(large.status(),302);assert.match(large.headers()['cache-control'],/no-store/);assert.match(large.headers().location,/1200|1600|1920|1957|2560|2936/);
  for(const width of [320,375,390,393,414,768,834,1024,1366,1920,2560]){await article.setViewportSize({width,height:width===1366?768:900});assert(await article.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.checks.push({engine:name,width,article:true});}
  await article.setViewportSize({width:390,height:844});await article.addStyleTag({content:'html{font-size:200%}'});assert(await article.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await article.screenshot({path:`${dir}/article-200-${name}.png`});
  report.checks.push({engine:name,workflow:'Real login, schema rejection, save, private preview, UI publish, draft isolation, revision conflict, update, restore, scheduled snapshot, shared media isolation, no-JS and private media access'});
  console.log(`PASS hosted framing workflow: ${name}`);await browser.close();browser=undefined;
 }
 assert.deepEqual(report.errors,[]);assert.equal(await realState(),before,'Real articles changed during disposable tests');report.success=true;
}catch(e){report.failure=(e as Error).message;await page?.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});throw e;}
finally{await browser?.close();for(const actor of actors){const r=await db.from('blog_posts').select('id').eq('created_by',actor);for(const p of r.data||[])if(!posts.includes(p.id))posts.push(p.id);}for(const id of posts){const r=await db.from('blog_posts').delete().eq('id',id);if(r.error)report.errors.push('Test post cleanup failed');}for(const id of actors)await db.auth.admin.deleteUser(id);await writeFile(dir+'/report.json',JSON.stringify(report,null,2));}


