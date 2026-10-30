/** Runs the built Worker with local PostgREST/Auth/Storage protocol fixtures and real PostgreSQL SQL/RLS. No hosted account or production data is used. */
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {request} from '@playwright/test';
import {exiftool} from 'exiftool-vendored';
import {emptySnapshot, COPYRIGHT} from '../src/lib/blog/model';

const dir='artifacts/blog-worker';await mkdir(dir,{recursive:true});
const pg=new PGlite();
await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter default privileges in schema public grant all on tables to anon,authenticated,service_role;grant usage on schema public,auth to anon,authenticated,service_role;`);
for(const name of ['202610270001_blog.sql','202610270002_atomic_editorial.sql','202610300001_cloudflare_media.sql'])await pg.exec((await readFile(`supabase/migrations/${name}`,'utf8')).replace('create extension if not exists pgcrypto;',''));
const accounts=[{id:randomUUID(),email:'owner@example.invalid',role:'owner'},{id:randomUUID(),email:'editor@example.invalid',role:'editor'}];
for(const a of accounts){await pg.query('insert into auth.users values($1)',[a.id]);await pg.query('insert into blog_members(user_id,role) values($1,$2)',[a.id,a.role]);}
const user=(a:typeof accounts[number])=>({id:a.id,aud:'authenticated',role:'authenticated',email:a.email,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{}});
const tokenExpiry=Math.floor(Date.now()/1000)+3600;
const jwt=(a:typeof accounts[number])=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:a.id,role:'authenticated',exp:tokenExpiry})).toString('base64url'),'local-protocol-fixture'].join('.');
const objects=new Map<string,Buffer>();let calls=0;
const tables=new Set(['blog_members','blog_posts','blog_revisions','blog_media','blog_taxonomies','blog_publications','blog_schedules','blog_redirects']);
const ident=(s:string)=>{if(!/^[a-z_]+$/.test(s))throw new Error('Invalid test identifier');return '"'+s+'"';};
const fixtures=createServer(async(req,res)=>{
  calls++;
  const json=(value:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
    const u=new URL(req.url!,'http://127.0.0.1:54328');const token=String(req.headers.authorization||'').replace('Bearer ','');
    if(u.pathname.startsWith('/auth/v1/')){
      let body='';for await(const chunk of req)body+=chunk;
      if(u.pathname==='/auth/v1/token'){const b=JSON.parse(body),a=accounts.find(a=>a.email===b.email);if(!a||b.password!=='local-editor-password')return json({message:'Invalid login credentials'},400);return json({access_token:jwt(a),token_type:'bearer',expires_in:3600,refresh_token:'local-refresh',user:user(a)});}
      if(u.pathname==='/auth/v1/user'){const a=accounts.find(a=>jwt(a)===token);return a?json(user(a)):json({message:'Invalid token'},401);}
      if(u.pathname==='/auth/v1/logout')return json({});
      return json({message:'Unsupported local Auth operation'},400);
    }
    if(u.pathname.startsWith('/storage/v1/object/')){
      const parts=decodeURIComponent(u.pathname).replace('/storage/v1/object/','').split('/');
      if(parts[0]==='upload'&&parts[1]==='sign'&&req.method==='POST')return json({url:`/object/upload/sign/${parts.slice(2).join('/')}?token=local-upload`,token:'local-upload'});
      const signed=parts[0]==='upload'&&parts[1]==='sign';if(signed)parts.splice(0,2);if(parts[0]==='authenticated')parts.shift();
      const path=parts.join('/');if(parts[0]==='blog-private'&&!signed&&token!=='local-service-key')return json({message:'Denied'},403);
      if(req.method==='GET'){const bytes=objects.get(path);if(!bytes)return json({message:'Not found'},404);res.writeHead(200,{'Content-Type':path.endsWith('.avif')?'image/avif':path.endsWith('.jpg')?'image/jpeg':'image/webp'});res.end(bytes);return;}
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));objects.set(path,Buffer.concat(chunks));return json({Key:path});
    }
    if(!u.pathname.startsWith('/rest/v1/'))return json({message:'Not found'},404);
    const resource=u.pathname.slice('/rest/v1/'.length);let text='';for await(const c of req)text+=c;const body=text?JSON.parse(text):undefined;
    const result=await pg.transaction(async tx=>{
      const role=token==='local-service-key'?'service_role':accounts.some(a=>jwt(a)===token)?'authenticated':'anon';await tx.exec(`set local role ${role}`);
      if(resource.startsWith('rpc/')){
        const fn=resource.slice(4);assert(['blog_save','blog_publish','blog_transition','blog_schedule','blog_search'].includes(fn));const keys=Object.keys(body||{});
        const r=await tx.query<any>(`select * from ${ident(fn)}(${keys.map((k,i)=>`${ident(k)}=>$${i+1}`).join(',')})`,keys.map(k=>body[k]));return fn==='blog_search'?r.rows:r.rows[0]?.[fn];
      }
      assert(tables.has(resource));const params:any[]=[],where:string[]=[];
      for(const [key,value]of u.searchParams){if(['select','order','limit','offset'].includes(key))continue;const field=ident(key);if(value==='is.null'){where.push(`${field} is null`);continue;}if(value.startsWith('in.(')){const values=value.slice(4,-1).split(',');where.push(`${field} in (${values.map(v=>{params.push(v.replace(/^"|"$/g,''));return '$'+params.length;}).join(',')})`);continue;}const index=value.indexOf('.'),op=value.slice(0,index),v=value.slice(index+1);const sqlop:Record<string,string>={eq:'=',lte:'<=',gte:'>=',lt:'<',gt:'>'};assert(sqlop[op]);params.push(v);where.push(`${field}${sqlop[op]}$${params.length}`);}
      const condition=where.length?' where '+where.join(' and '):'';
      if(req.method==='POST'){const rows=Array.isArray(body)?body:[body];const output:any[]=[];for(const row of rows){const keys=Object.keys(row);const r=await tx.query(`insert into ${ident(resource)}(${keys.map(ident).join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,keys.map(k=>row[k]));output.push(...r.rows);}return output;}
      if(req.method==='PATCH'){const keys=Object.keys(body);const start=params.length;params.push(...keys.map(k=>body[k]));return (await tx.query(`update ${ident(resource)} set ${keys.map((k,i)=>`${ident(k)}=$${start+i+1}`).join(',')}${condition} returning *`,params)).rows;}
      const fields=u.searchParams.get('select')||'*';assert(fields==='*'||/^[a-z_,]+$/.test(fields));let suffix='';if(u.searchParams.has('order'))suffix=' order by '+u.searchParams.get('order')!.split(',').map(p=>{const [k,sort]=p.split('.');return ident(k)+(sort==='desc'?' desc':' asc');}).join(',');if(u.searchParams.has('limit'))suffix+=' limit '+Number(u.searchParams.get('limit'));if(u.searchParams.has('offset'))suffix+=' offset '+Number(u.searchParams.get('offset'));
      return (await tx.query(`select ${fields==='*'?'*':fields.split(',').map(ident).join(',')} from ${ident(resource)}${condition}${suffix}`,params)).rows;
    });
    if(String(req.headers.accept).includes('vnd.pgrst.object'))return Array.isArray(result)&&result.length===1?json(result[0]):json({message:'No rows'},406);
    return json(result);
  }catch(e:any){json({message:e.message,code:e.code||'P0001'},e.code==='42501'?403:400);}
});await new Promise<void>(r=>fixtures.listen(54328,'127.0.0.1',r));
const base='https://127.0.0.1:4327';let log='';const report:any={kind:'Built Cloudflare Worker with local service-protocol fixtures and real PostgreSQL/RLS; does not certify hosted Auth/SMTP/Cron/CPU quotas',checks:[],maxServiceCalls:0};
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','dist-cloudflare/server/wrangler.json','--local','--local-protocol','https','--port','4327','--inspector-port','0','--var','SUPABASE_URL:http://127.0.0.1:54328','--var','SUPABASE_ANON_KEY:local-anon-key','--var','SUPABASE_SERVICE_ROLE_KEY:local-service-key','--var','BLOG_CRON_SECRET:local-cron-secret'],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});child.stdout?.on('data',b=>log+=b);child.stderr?.on('data',b=>log+=b);
// Wrangler's local certificate is trusted only by these isolated API test clients.
const owner=await request.newContext({baseURL:base,ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:base}}),editor=await request.newContext({baseURL:base,ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:base}}),visitor=await request.newContext({baseURL:base,ignoreHTTPSErrors:true});
async function api(ctx:any,action:string,body?:unknown,status=200){const before=calls;const r=body===undefined?await ctx.get(`/api/blog/${action}/`):await ctx.post(`/api/blog/${action}/`,{data:body});const data=await r.json();assert.equal(r.status(),status,JSON.stringify({action,data}));const used=calls-before;report.maxServiceCalls=Math.max(report.maxServiceCalls,used);assert(used<40,`${action} exceeded external service request budget: ${used}`);return data;}
try{
  let ready=false;for(let i=0;i<90;i++){if(child.exitCode!==null)break;try{if((await visitor.get('/admin/')).ok()){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}assert(ready,log);
  for(const path of ['/admin/?password=1','/conteudos/','/sitemap.xml']){const navigation=await visitor.get(path,{headers:{'Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'}});assert.equal(navigation.status(),200,`Browser navigation must reach SSR: ${path}`);assert(!(await navigation.text()).includes('<title>Página não encontrada'));}report.checks.push('Browser navigation headers reach SSR for invitations, public blog and sitemap');
  await api(visitor,'list',undefined,401);
  for(const [ctx,a]of [[owner,accounts[0]],[editor,accounts[1]]]as const){await api(ctx,'login',{email:a.email,password:'local-editor-password'});assert.equal((await api(ctx,'session')).role,a.role);}
  await api(editor,'invite',{email:'not-sent@example.invalid',role:'owner'},403);const csrf=await owner.post('/api/blog/trash/',{headers:{Origin:'https://wrong.example'},data:{id:randomUUID()}});assert.equal(csrf.status(),403);report.checks.push('Login cookies, owner/editor authorization, anonymous denial and CSRF in the built Worker');
  const upload=await api(editor,'upload',{name:'photo.webp',type:'image/webp',size:100000,alt:'Imagem institucional de demonstração',caption:'Teste de mídia',credit:'Acervo institucional',copyright:COPYRIGHT});
  const sent=await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':'image/webp'},body:await readFile('public/assets/official-entrance-480.webp')});assert(sent.ok);
  const asset=await api(editor,'media-ready',{id:upload.asset.id});assert.equal(asset.status,'ready');assert(asset.variants.every((v:any)=>v.width<=480));assert.equal(asset.variants.length,2);
  for(const v of asset.variants){const bytes=objects.get('blog-private/'+v.path)!;const path=`${dir}/uploaded.${v.format}`;await writeFile(path,bytes);const tags:any=await exiftool.read(path);assert.equal(tags.Copyright,COPYRIGHT);assert.equal(tags.Rights,COPYRIGHT);assert(!objects.has('blog-public/'+v.path));}report.checks.push('Private upload, Cloudflare Images, WebP/AVIF, native size, EXIF/XMP copyright and private originals');
  const fullId=randomUUID(),fullVariants:any[]=[];
  for(const format of ['webp','avif'])for(const width of [480,800,1200,1600,1920,2560,2936]){const path=`${fullId}/fixture-${width}.${format}`;objects.set('blog-private/'+path,await readFile(`public/assets/official-entrance-${width}.${format}`));fullVariants.push({path,width,height:Math.round(1957*width/2936),format});}
  await pg.query("insert into blog_media(id,original_path,alt,caption,credit,copyright,status,width,height,variants) values($1,$2,$3,'','',$4,'ready',2936,1957,$5)",[fullId,'originals/'+fullId+'.jpg','Imagem institucional em alta resolução',COPYRIGHT,fullVariants]);
  const tax=(await pg.query<any>('select * from blog_taxonomies')).rows,author=tax.find(t=>t.kind==='author'),category=tax.find(t=>t.kind==='category');
  const snapshot={...emptySnapshot(),title:'Demonstração do Worker',slug:'demonstracao-worker',authorId:author.id,categoryIds:[category.id],primaryCategoryId:category.id,coverId:asset.id,excerpt:'Texto neutro de verificação editorial.',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Demonstração do painel.'}]},{type:'image',attrs:{assetId:fullId}}]}};
  let saved=await api(editor,'save',{snapshot,version:0});await api(editor,'save',{id:saved.id,snapshot,version:0},409);
  assert.equal((await visitor.get('/conteudos/previa/'+saved.id+'/',{maxRedirects:0})).status(),303);
  await api(editor,'publish',{id:saved.id,version:saved.version},400);await api(editor,'prepare-media',{id:saved.id,version:saved.version,assetId:asset.id});await api(editor,'prepare-media',{id:saved.id,version:saved.version,assetId:fullId});await api(editor,'publish',{id:saved.id,version:saved.version});
  const html=await (await visitor.get('/conteudos/demonstracao-worker/')).text();assert(html.includes(snapshot.title)&&html.includes('BlogPosting'));assert.match(html,/noindex/);
  const changed={...snapshot,title:'Título salvo somente como rascunho',slug:'demonstracao-worker-atualizada'};saved=await api(editor,'save',{id:saved.id,snapshot:changed,version:saved.version});assert.equal((await pg.query<any>('select snapshot from blog_publications where id=$1',[saved.id])).rows[0].snapshot.title,snapshot.title);
  await api(editor,'prepare-media',{id:saved.id,version:saved.version,assetId:asset.id});await api(editor,'publish',{id:saved.id,version:saved.version});
  const redirect=await owner.get('/conteudos/demonstracao-worker/',{maxRedirects:0});assert.equal(redirect.status(),301);assert.equal(redirect.headers().location,'/conteudos/demonstracao-worker-atualizada/');report.checks.push('Prepared media, immutable public version, revision conflict, explicit update and 301 redirect');
  await api(editor,'unpublish',{id:saved.id});await api(editor,'trash',{id:saved.id});await api(editor,'restore',{id:saved.id});
  const scheduled=await api(editor,'save',{snapshot:{...snapshot,slug:'demonstracao-agendamento-worker'},version:0});await api(editor,'prepare-media',{id:scheduled.id,version:scheduled.version,assetId:asset.id});await api(editor,'prepare-media',{id:scheduled.id,version:scheduled.version,assetId:fullId});await api(editor,'schedule',{id:scheduled.id,version:scheduled.version,at:new Date(Date.now()+120000).toISOString()});await pg.query('update blog_schedules set run_at=now()-interval \'1 second\' where post_id=$1',[scheduled.id]);
  assert.equal((await visitor.post('/api/blog/cron/',{headers:{Authorization:'Bearer wrong'}})).status(),401);assert.equal((await visitor.post('/api/blog/cron/',{headers:{Authorization:'Bearer local-cron-secret'}})).status(),200);assert.equal((await pg.query<any>('select status from blog_schedules where post_id=$1',[scheduled.id])).rows[0].status,'published');report.checks.push('Unpublish, trash/restore, scheduling, authenticated Cron gateway and shared publisher');
  const privateResult=await owner.get('/admin/');assert.match(privateResult.headers()['cache-control'],/no-store/);assert.match(privateResult.headers()['x-robots-tag'],/noindex/);
  const old=await visitor.get('/saude-e-restauracao-dental-insituto-bicalho',{maxRedirects:0});assert.equal(old.status(),301);assert.match((await visitor.get('/')).headers()['x-robots-tag'],/noindex/);report.checks.push('Preview noindex headers, static legacy redirects and private panel no-store');
  console.log(`PASS: ${report.checks.length} built Worker integration groups; maximum ${report.maxServiceCalls} external service calls per tested editorial action.`);
}finally{
  child.kill();fixtures.close();await owner.dispose();await editor.dispose();await visitor.dispose();await pg.close();await exiftool.end();await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await writeFile(`${dir}/server.log`,log);
}
