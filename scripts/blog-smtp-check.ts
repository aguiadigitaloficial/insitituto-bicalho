/** Staged real-mail test. Export only the expected test message's link through the authorized mailbox UI. */
import {createClient} from '@supabase/supabase-js';
import {request,chromium,expect,type APIRequestContext} from '@playwright/test';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.BLOG_TEST_BASE!,ref=process.env.BLOG_TEST_PROJECT_REF;
const alias='institutobicalho.site+editor-teste@outlook.com',dir='artifacts/blog-smtp';
if(process.env.BLOG_INTEGRATION_CONFIRMED!=='true'||ref!=='whttbjpxlxdbwiptvkbs'||process.env.SUPABASE_URL!==`https://${ref}.supabase.co`||base!=='https://instituto-bicalho-blog-preview.institutobicalho-site.workers.dev')throw new Error('Use somente o projeto e a prévia aprovados.');
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
await mkdir(dir,{recursive:true});const phase=process.argv[2];
const read=async(name:string)=>JSON.parse(await readFile(`${dir}/${name}.json`,'utf8'));
const write=async(name:string,data:unknown)=>writeFile(`${dir}/${name}.json`,JSON.stringify(data,null,2),{mode:0o600});
const context=(storageState?:string)=>request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base},storageState});
async function post(ctx:APIRequestContext,action:string,data:unknown,status=200){const r=await ctx.post(`/api/blog/${action}/`,{data});assert.equal(r.status(),status,`${action}: ${await r.text()}`);return r.json();}
async function verify(ctx:APIRequestContext,kind:'invite'|'recovery'){
 const {url}=await read(kind==='invite'?'invite-link':'recovery-link');const tracked=new URL(url);assert(/\.sendibt\d+\.com$/.test(tracked.hostname));
 const outer=await fetch(url,{redirect:'manual'});const target=outer.headers.get('location');assert(target);const direct=new URL(target);assert.equal(direct.hostname,`${ref}.supabase.co`);assert.equal(direct.pathname,'/auth/v1/verify');assert.equal(direct.searchParams.get('type'),kind);
 const verified=await fetch(target,{redirect:'manual'});const destination=verified.headers.get('location');assert(destination);const returned=new URL(destination);assert.equal(returned.origin,base);const hash=new URLSearchParams(returned.hash.slice(1));assert(!hash.has('error'),`Link recusado: ${hash.get('error_code')}`);
 if(returned.searchParams.has('code')){
  // Follow canonical trailing-slash redirects just as a browser does. The PKCE verifier stays in this context.
  const callback=await ctx.get(destination,{maxRedirects:5});const final=new URL(callback.url());
  assert.equal(callback.status(),200,`Callback: ${callback.status()} ${final.pathname}`);assert.equal(final.pathname,'/admin/');assert.equal(final.searchParams.get('password'),'1');
 }else await post(ctx,'session-bootstrap',{access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});
 const session=await(await ctx.get('/api/blog/session/')).json();assert.equal(session.email,alias);assert.equal(session.role,'editor');
 const replay=await fetch(target,{redirect:'manual'});const replayLocation=replay.headers.get('location');assert(replayLocation);const rejection=new URLSearchParams(new URL(replayLocation).hash.slice(1));assert.equal(rejection.get('error_code'),'otp_expired');
 return {role:session.role,usedLinkRejected:true,pkce:returned.searchParams.has('code')};
}
async function cleanup(state:any){
 assert.equal(state.alias,alias);const account=await db.auth.admin.getUserById(state.userId);if(account.data.user){assert.equal(account.data.user.email,alias);const own=await db.from('blog_posts').select('id').eq('created_by',state.userId);for(const p of own.data||[])await db.from('blog_posts').delete().eq('id',p.id);await db.auth.admin.deleteUser(state.userId);}
 for(const name of ['invite-link','recovery-link','recovery-cookies','test-session'])await rm(`${dir}/${name}.json`,{force:true});
}
if(phase==='invite'){
 const list=await db.auth.admin.listUsers();assert(!list.data.users.some(u=>u.email===alias),'Não sobrescrever um acesso já existente.');
 const email=`bicalho-smtp-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');const actor=await db.auth.admin.createUser({email,password,email_confirm:true});if(actor.error)throw actor.error;const ctx=await context();
 try{const m=await db.from('blog_members').insert({user_id:actor.data.user.id,role:'owner'});if(m.error)throw m.error;await post(ctx,'login',{email,password});await post(ctx,'invite',{email:alias,role:'editor'});const users=await db.auth.admin.listUsers();const editor=users.data.users.find(u=>u.email===alias);assert(editor);await write('state',{startedAt:new Date().toISOString(),alias,userId:editor.id,inviteSent:true,deliveryFolder:'Junk'});console.log('Convite reenviado pelo aplicativo. Conferir entrega real e exportar somente o link do teste.');}
 finally{await ctx.dispose();await db.auth.admin.deleteUser(actor.data.user.id);}
}else if(phase==='accept'){
 const state=await read('state'),ctx=await context();try{const outcome=await verify(ctx,'invite');const password=randomBytes(24).toString('base64url');await post(ctx,'password',{password});await post(ctx,'logout',{});await post(ctx,'login',{email:alias,password});await write('test-session',{password});await post(ctx,'invite',{email:'not-sent@example.invalid',role:'owner'},403);await write('test-session',{password});await write('state',{...state,invitationAccepted:true,invitationPasswordLogin:true,invitationUsedLinkRejected:outcome.usedLinkRejected});console.log('Convite aceito, senha descartável salva, login e restrições de editor verificados.');}finally{await ctx.dispose();}
}else if(phase==='recover'){
 const state=await read('state'),ctx=await context();try{await post(ctx,'recover',{email:alias});await write('recovery-cookies',await ctx.storageState());await write('state',{...state,recoveryRequestedAt:new Date().toISOString()});console.log('Recuperação enviada; contexto PKCE preservado em arquivo privado.');}finally{await ctx.dispose();}
}else if(phase==='finish'){
 const state=await read('state'),credentials=await read('test-session'),ctx=await context(`${dir}/recovery-cookies.json`);let browser;
 try{
  const outcome=await verify(ctx,'recovery');const password=randomBytes(24).toString('base64url');await post(ctx,'password',{password});await post(ctx,'logout',{});await post(ctx,'login',{email:alias,password:credentials.password},401);await post(ctx,'login',{email:alias,password});await write('test-session',{password});await post(ctx,'invite',{email:'not-sent@example.invalid',role:'owner'},403);
  browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(base+'/admin/');await page.getByLabel('E-mail',{exact:true}).fill(alias);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('button',{name:'Nova publicação',exact:true}).waitFor();await expect(page.getByRole('button',{name:'Acessos',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Nova publicação',exact:true}).click();
  const title='Demonstração de acesso editorial',slug='demonstracao-acesso-'+randomUUID();await page.getByLabel('Título',{exact:true}).fill(title);await page.locator('.tiptap').fill('Seção de demonstração editorial');await page.getByRole('button',{name:'H2',exact:true}).click();await expect(page.locator('.tiptap h2')).toHaveText('Seção de demonstração editorial');const tax=await db.from('blog_taxonomies').select('id,kind');assert(tax.data);const author=tax.data.find(t=>t.kind==='author'),category=tax.data.find(t=>t.kind==='category');assert(author&&category);
  await page.getByRole('tab',{name:'Geral',exact:true}).click();await page.locator('[data-field=authorId]').selectOption(author.id);await page.locator('[data-field=excerpt]').fill('Publicação descartável para confirmar o acesso editorial.');await page.getByRole('tab',{name:'Categorias e tags',exact:true}).click();await page.locator('[data-field=categoryIds]').selectOption([category.id]);await page.locator('[data-field=primaryCategoryId]').selectOption(category.id);await page.getByRole('tab',{name:'SEO',exact:true}).click();await page.locator('[data-field=slug]').fill(slug);await page.getByRole('button',{name:'Publicar',exact:true}).click();await expect(page.locator('#admin-status')).toContainText('Publicação atualizada',{timeout:30000});const publicPage=await ctx.get(`/conteudos/${slug}/`);assert.equal(publicPage.status(),200);assert((await publicPage.text()).includes(title));await page.screenshot({path:`${dir}/editor-convidado-390.png`,fullPage:false});await page.getByRole('button',{name:'Retirar de publicação',exact:true}).click();await expect(page.locator('#admin-status')).toContainText('Artigo retirado');await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('heading',{name:'Entrar no painel'})).toBeVisible();
  await cleanup(state);await write('report',{...state,completedAt:new Date().toISOString(),recoveryDelivered:true,recoveryPKCE:outcome.pkce,passwordChanged:true,oldPasswordDenied:true,newPasswordLogin:true,editorPublication:true,ownerControlsDenied:true,usedRecoveryLinkDenied:outcome.usedLinkRejected,testUserRemoved:true});console.log('PASS: convite real, senha, login, recuperação PKCE, links usados recusados, publicação por editor e limpeza do acesso descartável.');
 }finally{if(browser)await browser.close();await ctx.dispose();}
}else if(phase==='cleanup'){await cleanup(await read('state'));console.log('Somente o acesso e os artigos descartáveis deste teste foram removidos.');}
else throw new Error('Fase esperada: invite, accept, recover, finish ou cleanup.');
