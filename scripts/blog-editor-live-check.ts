/** Real browser/editor integration. Disposable accounts and articles only, in the approved preview. */
import {chromium,webkit,expect,type Page,type Browser} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {COPYRIGHT} from '../src/lib/blog/model';

const base=new URL(process.env.BLOG_TEST_BASE!).origin;
const ref=process.env.BLOG_TEST_PROJECT_REF;
if(process.env.BLOG_INTEGRATION_CONFIRMED!=='true'||!ref||process.env.SUPABASE_URL!==`https://${ref}.supabase.co`||!/^https:\/\/instituto-bicalho-blog-preview\.[a-z0-9-]+\.workers\.dev$/.test(base))throw new Error('Use somente a prévia e o projeto de teste autorizados.');
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const output='artifacts/blog-editor-live';await mkdir(output,{recursive:true});
const accounts:string[]=[],assets:string[]=[],articles:string[]=[],registrations:string[]=[];
const report:any={kind:'Real Chromium/WebKit UI, Supabase and Cloudflare integration; SMTP delivery is verified separately',base,testedAt:new Date().toISOString(),checks:[],errors:[]};
let browser:Browser|undefined;let diagnosticPage:Page|undefined;
const widths=process.argv.includes('--quick')?[390,834,1366]:[320,375,390,393,414,600,768,834,1024,1199,1200,1366,1440,1920,2560];
const button=(p:Page,name:string)=>p.getByRole('button',{name,exact:true});
const tab=(p:Page,name:string)=>p.getByRole('tab',{name,exact:true}).click();
async function tool(p:Page,name:string){await p.locator('.editor-toolbar').getByRole('button',{name,exact:true}).click();if(!['Link','Imagem'].includes(name))await expect(p.locator('.tiptap')).toBeFocused();}
async function save(p:Page){await button(p,'Salvar agora').click();await expect(p.locator('#save-status')).toHaveText('Salvo',{timeout:15000});}
async function paragraph(p:Page,text:string){const box=p.locator('.tiptap');await box.press('ControlOrMeta+End');await box.press('Enter');await tool(p,'Parágrafo');await p.keyboard.insertText(text);}
async function selectLine(p:Page){const line=p.locator('.tiptap p').filter({hasText:/\S/}).last();const text=(await line.innerText()).trim();if(await line.locator('a').count())await line.locator('a').click();else await line.click({clickCount:3});await expect.poll(()=>p.evaluate(()=>getSelection()?.toString().trim())).toBe(text);}
async function noOverflow(p:Page,label:string){await p.evaluate(()=>document.fonts.ready);const dimensions=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(dimensions.scroll<=dimensions.width,`${label}: ${JSON.stringify(dimensions)}`);}
async function pick(p:Page,field:string,assetId:string){await p.locator(`[data-media-field="${field}"]`).click();await p.locator(`[data-pick="${assetId}"]`).click();}
async function reopen(p:Page,title:string){await p.reload();await p.locator('.admin-post-row').filter({has:p.getByRole('heading',{name:title,exact:true})}).getByRole('button',{name:'Editar',exact:true}).click();}
async function managementViews(p:Page,name:string){
 for(const width of [320,390,768,834,1024,1366]){
  await p.setViewportSize({width,height:width===1366?768:900});
  for(const view of ['Publicações','Biblioteca de mídia','Categorias','Tags','Autores','Acessos']){
   await p.locator('.admin-nav').getByRole('button',{name:view,exact:true}).click();await expect(p.locator('.admin-workspace h1')).toHaveText(view);await noOverflow(p,`${name}/${width}/${view}`);
   if(view==='Biblioteca de mídia'||['Categorias','Tags','Autores'].includes(view)){
    await button(p,view==='Biblioteca de mídia'?'Enviar imagem':'Novo cadastro').click();await expect(p.locator('#admin-dialog')).toBeVisible();await noOverflow(p,`${name}/${width}/${view}/dialog`);await button(p,'Fechar').click();
   }
   if(view==='Acessos')await expect(p.locator('#invite-form')).toBeVisible();
  }
  report.checks.push({engine:name,width,managementViews:6,dialogs:4});
 }
}

try{
 const tax=await db.from('blog_taxonomies').select('*');if(tax.error)throw tax.error;
 const author=tax.data.find(t=>t.kind==='author'),category=tax.data.find(t=>t.kind==='category'),tagRow=tax.data.find(t=>t.kind==='tag');assert(author&&category);const related=await db.from('blog_publications').select('id').eq('is_demo',true).limit(3);if(related.error)throw related.error;
 for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']] as const){
  if(process.argv.includes('--chromium-only')&&name!=='chromium'||process.argv.includes('--webkit-only')&&name!=='webkit')continue;
  console.log(`Testando editor real: ${name}`);
  const marker=randomUUID(),email=`bicalho-ui-${marker}@example.invalid`,password=randomBytes(24).toString('base64url');
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;accounts.push(created.data.user.id);
  const member=await db.from('blog_members').insert({user_id:created.data.user.id,role:'owner'});if(member.error)throw member.error;
  browser=await engine.launch(name==='chromium'?{channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}:{});
  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage();diagnosticPage=page;
  page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
  // UUIDs are captured from real successful UI requests solely to clean up this run.
  page.on('response',async r=>{try{if(r.request().method()!=='POST')return;const path=new URL(r.url()).pathname;if(!r.ok()){if(path==='/api/blog/upload/'){const sent=r.request().postDataJSON();console.log(JSON.stringify({action:'upload',status:r.status(),type:sent.type,size:sent.size,response:await r.json()}));}return;}
   if(path==='/api/blog/save/'){const row=await r.json();if(!articles.includes(row.id))articles.push(row.id);}
   if(path==='/api/blog/upload/'){const row=await r.json();assets.push(row.asset.id);}
   if(path==='/api/blog/taxonomy/'){const row=await r.json();if(!registrations.includes(row.id))registrations.push(row.id);}
  }catch{}});
  await page.goto(base+'/admin/');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await button(page,'Entrar').click();await button(page,'Nova publicação').waitFor();
  // Upload using the actual file input and the signed Storage path.
  await button(page,'Biblioteca de mídia').click();await button(page,'Enviar imagem').click();
  await page.locator('#media-form input[type=file]').setInputFiles('public/assets/official-entrance-480.webp');
  const alt=`Fotografia institucional de demonstração ${marker}`;
  await page.getByLabel('Texto alternativo',{exact:true}).fill(alt);await page.getByLabel('Legenda',{exact:true}).fill('Legenda da fotografia de demonstração.');await page.getByLabel('Crédito',{exact:true}).fill('Acervo institucional do Instituto Bicalho');await expect(page.getByLabel('Direitos autorais',{exact:true})).toHaveValue(COPYRIGHT);
  await button(page,'Enviar e otimizar').click();await expect(page.locator('#admin-dialog')).not.toBeVisible({timeout:60000});
  const mediaButton=page.locator('[data-edit-media]').filter({hasText:alt});await mediaButton.click();await page.getByLabel('Legenda',{exact:true}).fill('Legenda de demonstração atualizada.');await button(page,'Salvar imagem').click();await expect(page.locator('#admin-dialog')).not.toBeVisible({timeout:30000});
  const assetId=await mediaButton.getAttribute('data-edit-media');assert(assetId);
  await button(page,'Publicações').click();await button(page,'Nova publicação').click();
  const title=`Demonstração editorial ${name} ${marker.slice(0,8)}`,slug=`demonstracao-ui-${marker}`;
  await page.getByLabel('Título',{exact:true}).fill(title);
  await page.locator('.tiptap').fill('Seção de demonstração');await tool(page,'H2');await expect(page.locator('.tiptap h2')).toHaveText('Seção de demonstração');await expect(page.locator('[data-tool="h2"]')).toHaveAttribute('aria-pressed','true');
  await paragraph(page,'Subseção de demonstração');await tool(page,'H3');await expect(page.locator('.tiptap h3')).toHaveText('Subseção de demonstração');await expect(page.locator('[data-tool="h3"]')).toHaveAttribute('aria-pressed','true');
  await tool(page,'Parágrafo');await expect(page.locator('.tiptap h3')).toHaveCount(0);await tool(page,'H3');
  await paragraph(page,'Texto com formatação de demonstração.');await selectLine(page);await tool(page,'Negrito');await tool(page,'Itálico');await tool(page,'Sublinhado');await expect(page.locator('.tiptap strong em u,.tiptap u em strong,.tiptap strong u em,.tiptap em strong u,.tiptap u strong em,.tiptap em u strong')).toHaveCount(1);
  await tool(page,'Desfazer');await expect(page.locator('.tiptap u')).toHaveCount(0);await tool(page,'Refazer');await expect(page.locator('.tiptap u')).toHaveCount(1);
  await paragraph(page,'Primeiro item com marcador');await tool(page,'Lista');await page.keyboard.press('Enter');await page.keyboard.insertText('Segundo item com marcador');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await expect(page.locator('.tiptap ul li')).toHaveCount(2);
  await page.keyboard.insertText('Primeiro item numerado');await tool(page,'Lista numerada');await page.keyboard.press('Enter');await page.keyboard.insertText('Segundo item numerado');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(page.locator('.tiptap ol li')).toHaveCount(2);
  await page.keyboard.insertText('Citação neutra de demonstração.');await tool(page,'Citação');await expect(page.locator('.tiptap blockquote')).toContainText('Citação neutra');await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await page.keyboard.insertText('Link institucional de demonstração');await selectLine(page);await tool(page,'Link');await page.getByLabel('Endereço',{exact:true}).fill('https://institutobicalho.com/contato/');await button(page,'Aplicar link').click();await expect(page.locator('.tiptap')).toBeFocused();await expect(page.locator('.tiptap a')).toHaveAttribute('href','https://institutobicalho.com/contato/');
  await selectLine(page);await tool(page,'Link');await button(page,'Remover link').click();await expect(page.locator('.tiptap')).toBeFocused();await expect(page.locator('.tiptap a')).toHaveCount(0);await selectLine(page);await tool(page,'Link');await page.getByLabel('Endereço',{exact:true}).fill('https://institutobicalho.com/contato/');await button(page,'Aplicar link').click();await expect(page.locator('.tiptap')).toBeFocused();
  await paragraph(page,'Tabela de demonstração');await tool(page,'Tabela');await expect(page.locator('.tiptap table tr')).toHaveCount(3);await page.locator('.tiptap td').first().click();await page.keyboard.insertText('Célula de demonstração');await tool(page,'+ Linha');await expect(page.locator('.tiptap table tr')).toHaveCount(4);await tool(page,'+ Coluna');await expect(page.locator('.tiptap table tr').first().locator('th,td')).toHaveCount(4);
  await tool(page,'Excluir tabela');await expect(page.locator('.tiptap table')).toHaveCount(0);await tool(page,'Desfazer');await expect(page.locator('.tiptap table')).toHaveCount(1);await tool(page,'Refazer');await expect(page.locator('.tiptap table')).toHaveCount(0);await tool(page,'Tabela');
  await page.locator('.tiptap').press('ControlOrMeta+End');await page.locator('.tiptap').press('ArrowDown');await tool(page,'Imagem');await page.locator(`[data-pick="${assetId}"]`).click();await expect(page.locator('.tiptap img')).toHaveAttribute('alt',alt);
  report.checks.push({engine:name,controls:'Paragraph, H2, H3, marks, lists, quote, link insert/remove, table add/delete, image, undo/redo'});
  await tab(page,'Geral');await page.locator('[data-field="authorId"]').selectOption(author.id);await page.locator('[data-field="excerpt"]').fill('Trecho neutro para conferir as listagens da demonstração.');await pick(page,'coverId',assetId);await pick(page,'thumbnailId',assetId);await page.locator('[data-field="featured"]').check();await page.locator('[data-field="relatedIds"]').selectOption(related.data.map(p=>p.id));
  await tab(page,'Categorias e tags');await page.locator('[data-field="categoryIds"]').selectOption([category.id]);await page.locator('[data-field="primaryCategoryId"]').selectOption(category.id);if(tagRow)await page.locator('[data-field="tagIds"]').selectOption([tagRow.id]);
  await tab(page,'SEO');await page.locator('[data-field="slug"]').fill(slug);await page.locator('[data-field="seo.title"]').fill('Meta título de demonstração');await page.locator('[data-field="seo.description"]').fill('Descrição de busca independente do trecho de demonstração.');await page.locator('[data-field="seo.focusKeyword"]').fill('demonstração');await page.locator('[data-field="seo.nofollow"]').check();await page.locator('[data-field="seo.noimageindex"]').check();await page.locator('[data-field="seo.nosnippet"]').check();
  await tab(page,'Compartilhamento');for(const [field,value] of Object.entries({'social.title':'Título social de demonstração','social.description':'Descrição social de demonstração.','social.alt':'Texto alternativo social de demonstração','social.twitterTitle':'Título X de demonstração','social.twitterDescription':'Descrição X de demonstração.','social.twitterAlt':'Texto alternativo X de demonstração'}))await page.locator(`[data-field="${field}"]`).fill(value);await pick(page,'social.imageId',assetId);await pick(page,'social.twitterImageId',assetId);
  await tab(page,'Avançado');await page.locator('#extra-meta').fill('{');await expect(page.locator('#save-status')).toContainText('JSON inválido');await button(page,'Salvar agora').click();await expect(page.locator('#admin-status')).toContainText('Corrija o JSON');await page.locator('#extra-meta').fill('[{"name":"editorial-test","content":"Demonstração"}]');
  await page.locator('[data-field="extraJsonLd"]').fill('{"@type":"BlogPosting"}');const rejected=page.waitForResponse(r=>r.url().endsWith('/api/blog/save/')&&r.request().method()==='POST'&&r.status()===400);await button(page,'Salvar agora').click();await rejected;await expect(page.locator('#save-status')).not.toHaveText('Salvo');
  await page.locator('[data-field="extraJsonLd"]').fill('{"@context":"https://schema.org","@type":"Thing","name":"Demonstração editorial"}');await save(page);
  const saved=await db.from('blog_posts').select('*').eq('created_by',created.data.user.id).single();if(saved.error)throw saved.error;const postId=saved.data.id;assert(articles.includes(postId));
  assert.equal(saved.data.draft.excerpt,'Trecho neutro para conferir as listagens da demonstração.');assert.notEqual(saved.data.draft.excerpt,saved.data.draft.seo.description);assert.equal(saved.data.draft.coverId,assetId);
  await reopen(page,title);await expect(page.locator('.tiptap h2')).toHaveText('Seção de demonstração');await expect(page.locator('.tiptap h3')).toHaveText('Subseção de demonstração');await expect(page.locator('.tiptap img')).toHaveAttribute('alt',alt);await expect(page.locator('.tiptap table')).toHaveCount(1);await expect(page.locator('.tiptap u').filter({hasText:'Texto com formatação de demonstração.'})).toHaveCount(1);report.checks.push({engine:name,persistence:'Real saved JSON reloaded through the editor'});
  for(const width of widths){await page.setViewportSize({width,height:width===1366?768:900});for(const nameTab of ['Conteúdo','Geral','Categorias e tags','SEO','Compartilhamento','Avançado']){await tab(page,nameTab);await noOverflow(page,`${name}/${width}/${nameTab}`);}report.checks.push({engine:name,width,adminTabs:6});}
  await page.setViewportSize({width:390,height:844});await tab(page,'Conteúdo');await page.addStyleTag({content:'html{font-size:200%}'});await noOverflow(page,`${name}/editor/200%`);await page.screenshot({path:`${output}/editor-390-200-${name}.png`,fullPage:false});await page.locator('html').evaluate(el=>el.style.fontSize='');await page.reload();await page.locator('.admin-post-row').filter({hasText:title}).getByRole('button',{name:'Editar',exact:true}).click();
  await page.setViewportSize({width:1366,height:768});await button(page,'Publicar').click();await expect(page.locator('#admin-status')).toContainText('Publicação atualizada',{timeout:60000});
  const article=await context.newPage();await article.goto(base+`/conteudos/${slug}/`);await expect(article.locator('.article-prose h2')).toHaveText('Seção de demonstração');await expect(article.locator('.article-prose h3')).toHaveText('Subseção de demonstração');await expect(article.locator('.article-prose u').filter({hasText:'Texto com formatação de demonstração.'})).toHaveCount(1);await expect(article.locator('.article-prose table')).toHaveCount(1);await expect(article.locator('.article-prose a')).toHaveAttribute('href','https://institutobicalho.com/contato/');await expect(article.locator('.article-prose figcaption')).toHaveText('Legenda de demonstração atualizada.');await expect(article.locator('a[href="#secao-de-demonstracao"]')).toHaveCount(1);await expect(article.locator('a[href="#subsecao-de-demonstracao"]')).toHaveCount(1);
  assert.equal(await article.locator('title').textContent(),'Meta título de demonstração | Instituto Bicalho');await expect(article.locator('meta[name="description"]')).toHaveAttribute('content','Descrição de busca independente do trecho de demonstração.');await expect(article.locator('meta[property="og:title"]')).toHaveAttribute('content','Título social de demonstração');await expect(article.locator('meta[name="twitter:title"]')).toHaveAttribute('content','Título X de demonstração');await expect(article.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);await expect(article.locator('meta[name="keywords"]')).toHaveCount(0);const schemas=await article.locator('script[type="application/ld+json"]').allTextContents();assert(schemas.some(s=>s.includes('BlogPosting')));assert(schemas.some(s=>s.includes('Demonstração editorial')));
  const html=await (await context.request.get(base+`/conteudos/${slug}/`)).text();assert(html.includes('<h2 id="secao-de-demonstracao">'));assert(html.includes('<h3 id="subsecao-de-demonstracao">'));report.checks.push({engine:name,published:'SSR headings, index, formats, tables, caption, SEO/social/JSON-LD'});
  for(const width of widths){await article.setViewportSize({width,height:width===1366?768:900});await noOverflow(article,`${name}/article/${width}`);if([390,834,1366].includes(width))await article.screenshot({path:`${output}/article-${width}-${name}.png`,fullPage:true});report.checks.push({engine:name,width,article:true});}
  await article.close();await page.locator('[data-field="title"]').fill(title+' atualizado');await save(page);const unchanged=await context.request.get(base+`/conteudos/${slug}/`);assert(!(await unchanged.text()).includes(title+' atualizado'));
  const history=await db.from('blog_revisions').select('*').eq('post_id',postId).order('version',{ascending:true});if(history.error)throw history.error;assert(history.data.length>1);const oldest=history.data[0],latest=history.data.at(-1)!;
  await button(page,'Revisões').click();await page.locator(`[data-revision="${oldest.id}"]`).click();await expect(page.locator('#admin-dialog')).not.toBeVisible();assert.deepEqual((await db.from('blog_posts').select('draft').eq('id',postId).single()).data?.draft,oldest.snapshot);
  assert(!(await (await context.request.get(base+`/conteudos/${slug}/`)).text()).includes(title+' atualizado'));
  await button(page,'Revisões').click();await page.locator(`[data-revision="${latest.id}"]`).click();await expect(page.locator('#admin-dialog')).not.toBeVisible();assert.deepEqual((await db.from('blog_posts').select('draft').eq('id',postId).single()).data?.draft,latest.snapshot);await page.locator('[data-publish]').click();await expect(page.locator('#admin-status')).toContainText('Publicação atualizada',{timeout:60000});
  await button(page,'Retirar de publicação').click();await expect(page.locator('#admin-status')).toContainText('Artigo retirado');await button(page,'Enviar à lixeira').click();await expect(page.getByRole('heading',{name:'Publicações',exact:true})).toBeVisible();await page.getByLabel('Filtrar situação').selectOption('Lixeira');await page.locator('.admin-post-row').filter({hasText:title}).getByRole('button',{name:'Restaurar',exact:true}).click();await page.getByLabel('Filtrar situação').selectOption('Rascunho');await expect(page.locator('.admin-post-row').filter({hasText:title})).toHaveCount(1);
  const scheduleTitle=`Demonstração de agendamento ${marker.slice(0,8)}`;const pending=await context.request.post(base+'/api/blog/save/',{headers:{Origin:base},data:{snapshot:{...latest.snapshot,title:scheduleTitle,slug:slug+'-agendado'},version:0}});assert(pending.ok());const schedulePost=await pending.json();articles.push(schedulePost.id);
  await page.locator('.admin-nav').getByRole('button',{name:'Publicações',exact:true}).click();await page.locator('.admin-post-row').filter({hasText:scheduleTitle}).getByRole('button',{name:'Editar',exact:true}).click();const when=new Date(Date.now()+180000);const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(when).replace(' ','T');await page.getByLabel('Data e horário de São Paulo').fill(local);await button(page,'Agendar publicação').click();await expect(page.locator('#schedule-status')).toContainText('Agendado para',{timeout:60000});assert((await db.from('blog_schedules').select('post_id').eq('post_id',schedulePost.id)).data?.length===1);await button(page,'Cancelar agendamento').click();await expect(page.locator('#schedule-status')).toContainText('Nenhum agendamento');assert((await db.from('blog_schedules').select('post_id').eq('post_id',schedulePost.id)).data?.length===0);
  await managementViews(page,name);
  for(const view of ['Categorias','Tags','Autores']){await page.locator('.admin-nav').getByRole('button',{name:view,exact:true}).click();await button(page,'Novo cadastro').click();const label=`Demonstração ${view} ${marker.slice(0,8)}`;await page.getByLabel('Nome',{exact:true}).fill(label);await page.getByLabel('Slug',{exact:true}).fill(`demonstracao-${view.toLowerCase()}-${marker}`);await page.getByLabel('Descrição',{exact:true}).fill('Cadastro descartável de demonstração.');await button(page,'Salvar').click();const row=page.locator('.admin-post-row').filter({hasText:label});await row.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Nome',{exact:true}).fill(label+' revisado');await button(page,'Salvar').click();await expect(page.getByRole('heading',{name:label+' revisado',exact:true})).toBeVisible();}
  await button(page,'Sair').click();await expect(page.getByRole('heading',{name:'Entrar no painel'})).toBeVisible();await page.goto(base+'/api/blog/callback/?code=invalid-test-code');await expect(page.getByRole('alert')).toHaveText('Link de acesso inválido ou expirado. Solicite outro.');await expect(page.getByRole('heading',{name:'Entrar no painel'})).toBeVisible();await page.goto(base+'/admin/#error=access_denied&error_code=otp_expired');await expect(page.locator('#admin-status')).toHaveText('Link de acesso inválido ou expirado. Solicite outro.');report.checks.push({engine:name,lifecycle:'Draft isolation, historical revision restoration, update, unpublish, trash/restore, schedule/cancel in Sao Paulo, taxonomy create/edit, logout and invalid/expired-link screen'});
  await browser.close();browser=undefined;
 }
 assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();console.log(`PASS: ${report.checks.length} real editor checks; SMTP delivery certified separately.`);
}catch(e){report.failure=(e as Error).message;if(diagnosticPage){await diagnosticPage.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(output+'/failure-editor.html',await diagnosticPage.locator('.tiptap').innerHTML().catch(()=>''));}throw e;}
finally{
 if(browser)await browser.close();
 for(const actor of accounts){const own=await db.from('blog_posts').select('id').eq('created_by',actor);for(const p of own.data||[])if(!articles.includes(p.id))articles.push(p.id);}
 for(const id of articles)await db.from('blog_posts').delete().eq('id',id);
 for(const id of registrations)await db.from('blog_taxonomies').delete().eq('id',id);
 for(const id of assets){const a=await db.from('blog_media').select('*').eq('id',id).maybeSingle();for(const bucket of ['blog-private','blog-public']){const objects=await db.storage.from(bucket).list(id);const paths=(objects.data||[]).map(o=>`${id}/${o.name}`);if(bucket==='blog-private'&&a.data)paths.push(a.data.original_path);if(paths.length)await db.storage.from(bucket).remove(paths);}await db.from('blog_media').delete().eq('id',id);}
 for(const id of accounts)await db.auth.admin.deleteUser(id);
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));
}
