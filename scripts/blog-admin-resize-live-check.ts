/** Hosted form/dialog reflow at normal and 200% text size; disposable editor data only. */
import {chromium,webkit,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BLOG_TEST_BASE!;
if(base!=='https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev'||process.env.BLOG_TEST_PROJECT_REF!=='whttbjpxlxdbwiptvkbs'||process.env.BLOG_INTEGRATION_CONFIRMED!=='true')throw new Error('Somente a prévia autorizada.');
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const dir='artifacts/blog-admin-resize';await mkdir(dir,{recursive:true});
const report:any={base,startedAt:new Date().toISOString(),checks:[],errors:[]};
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']] as const){
 const email=`bicalho-resize-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
 const actor=await db.auth.admin.createUser({email,password,email_confirm:true});if(actor.error)throw actor.error;
 const member=await db.from('blog_members').insert({user_id:actor.data.user.id,role:'owner'});if(member.error)throw member.error;
 const browser=await engine.launch(name==='chromium'?{channel:'chrome'}:{}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
 async function reflow(label:string){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));const d=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));if(d.scroll>d.width)await writeFile(`${dir}/overflow-${name}.json`,JSON.stringify(await page.locator('body *').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({tag:e.tagName,cls:e.className,scroll:e.scrollWidth,width:e.clientWidth}))),null,2));assert(d.scroll<=d.width,`${name}/${label}: ${JSON.stringify(d)}`);report.checks.push({engine:name,label});}
 try{
  await page.goto(base+'/admin/');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('button',{name:'Nova publicação',exact:true}).click();
  const title=`Demonstração de ampliação ${randomUUID()}`;await page.getByLabel('Título',{exact:true}).fill(title);await page.locator('.tiptap').fill('Texto de demonstração para testar a leitura ampliada.');await page.getByRole('tab',{name:'Geral',exact:true}).click();const author=await db.from('blog_taxonomies').select('id').eq('kind','author').limit(1).single();assert(author.data);await page.locator('[data-field=authorId]').selectOption(author.data.id);await page.getByRole('button',{name:'Salvar agora',exact:true}).click();await expect(page.locator('#save-status')).toHaveText('Salvo');
  for(const width of [320,390,834,1366])for(const scale of [1,2]){
   await page.setViewportSize({width,height:width===1366?768:900});const style=await page.addStyleTag({content:`html{font-size:${scale*100}%}`});
   for(const tab of ['Conteúdo','Geral','Categorias e tags','SEO','Compartilhamento','Avançado']){await page.getByRole('tab',{name:tab,exact:true}).click();await reflow(`${width}/${scale}/${tab}`);}
   await page.getByRole('tab',{name:'Geral',exact:true}).click();await page.locator('[data-media-field=coverId]').click();await expect(page.locator('#admin-dialog')).toBeVisible();await reflow(`${width}/${scale}/selecionar imagem`);await page.getByRole('button',{name:'Fechar',exact:true}).click();
   await page.getByRole('button',{name:'Revisões',exact:true}).click();await expect(page.locator('#admin-dialog')).toBeVisible();await reflow(`${width}/${scale}/revisões`);await page.getByRole('button',{name:'Fechar',exact:true}).click();
   if(width===320&&scale===2){await page.getByRole('tab',{name:'Conteúdo',exact:true}).click();await page.screenshot({path:`${dir}/editor-320-200-${name}.png`,fullPage:true});}
   await style.evaluate(el=>(el as Element).remove());
  }
  await page.locator('.admin-nav').getByRole('button',{name:'Biblioteca de mídia',exact:true}).click();
  for(const width of [320,390,834]){await page.setViewportSize({width,height:900});const style=await page.addStyleTag({content:'html{font-size:200%}'});await page.getByRole('button',{name:'Enviar imagem',exact:true}).click();await expect(page.locator('#admin-dialog')).toBeVisible();await reflow(`${width}/2/enviar imagem`);await page.getByRole('button',{name:'Fechar',exact:true}).click();await style.evaluate(el=>(el as Element).remove());}
  console.log(`PASS: ${name} administrative forms and dialogs at 100%/200%`);
 }catch(e){report.failure=String(e);await page.screenshot({path:`${dir}/failure-${name}.png`,fullPage:true});throw e;}
 finally{await browser.close();const posts=await db.from('blog_posts').select('id').eq('created_by',actor.data.user.id);for(const p of posts.data||[])await db.from('blog_posts').delete().eq('id',p.id);await db.auth.admin.deleteUser(actor.data.user.id);await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));}
}
assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(`PASS: ${report.checks.length} hosted form/dialog reflow checks.`);
