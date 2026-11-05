/** Isolated UI tests. Real application UI with in-memory API fixtures; no hosted data writes. */
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,webkit,expect,type Page,type Browser,type BrowserContext} from '@playwright/test';
import {emptySnapshot,snapshotSchema,COPYRIGHT,type Asset} from '../src/lib/blog/model';

const base=process.env.BLOG_FRAMING_UI_BASE||'http://127.0.0.1:4327';
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(base),'Only a local server is allowed for this fixture suite.');
const output='artifacts/blog-framing-ui';await mkdir(output,{recursive:true});
const id=(n:number)=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const fixtures=[
 {name:'Retrato institucional de teste',width:1600,height:2400,path:'public/assets/official-partners-together-1600.webp'},
 {name:'Recepção horizontal de teste',width:1600,height:1066,path:'public/assets/official-entrance-1600.webp'},
 {name:'Imagem quadrada de teste',width:1200,height:1200},
 {name:'Imagem pequena de teste',width:200,height:300},
];
const assets:Asset[]=fixtures.map((f,n)=>({id:id(100+n),alt:f.name,width:f.width,height:f.height,caption:'Legenda de teste.',credit:'Acervo de teste',copyright:COPYRIGHT,status:'published',original_path:'',variants:[{path:`fixture-${n}.webp`,width:f.width,height:f.height,format:'webp'}]}));
const taxonomy=[{id:id(1),kind:'author',name:'Instituto Bicalho',slug:'instituto',description:''},{id:id(2),kind:'category',name:'Tratamentos',slug:'tratamentos',description:''}];
const initial={...emptySnapshot(),title:'Demonstração isolada de enquadramento',slug:'demonstracao-isolada-enquadramento',authorId:id(1),categoryIds:[id(2)],primaryCategoryId:id(2),coverId:assets[0].id,excerpt:'Publicação descartável para conferir os controles de enquadramento.',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Conteúdo de demonstração.'}]}]}};
initial.social.imageId=assets[0].id;
type Store={row:any;saves:number;published:any;requests:{action:string;status:number}[]};
const report:any={kind:'Local UI with isolated API fixtures; not a hosted delivery test',base,checks:[],errors:[]};
let browser:Browser|undefined,diagnostic:Page|undefined;
let serverLog='';
const child=process.env.BLOG_FRAMING_UI_BASE?undefined:spawn(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','127.0.0.1','--port','4327'],{stdio:['ignore','pipe','pipe'],env:{...process.env,PUBLIC_INDEXABLE:'false',PUBLIC_GA_ID:'',SUPABASE_URL:'',SUPABASE_ANON_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''}});
child?.stdout?.on('data',b=>serverLog+=b);child?.stderr?.on('data',b=>serverLog+=b);
async function install(context:BrowserContext,store:Store){
 await context.route('**/admin/',async route=>{const response=await route.fetch(),source=await response.text(),body=source.replace(/<section class="admin-login"[^>]*>[\s\S]*?<\/section>/,'<div id="editorial-app"></div>');assert.notEqual(body,source);await route.fulfill({response,body});});
 await context.route('**/api/blog/**',async route=>{
  const url=new URL(route.request().url()),action=url.pathname.split('/').filter(Boolean).at(-1)!;let result:any={ok:true};
  if(action==='media-file'){
   const index=assets.findIndex(a=>a.id===url.searchParams.get('id'));assert(index>=0);
   const f=fixtures[index];
   if(f.path)return route.fulfill({contentType:'image/webp',body:await readFile(f.path)});
   return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${f.width}" height="${f.height}" viewBox="0 0 ${f.width} ${f.height}"><rect width="100%" height="100%" fill="#d4e3e8"/><rect x="1" y="1" width="${f.width-2}" height="${f.height-2}" fill="none" stroke="#102f43" stroke-width="2"/><circle cx="${f.width/2}" cy="${f.height/2}" r="${f.width/4}" fill="#007c85"/></svg>`});
  }
  if(action==='list')result={posts:[store.row],media:assets,taxonomies:taxonomy,publications:[{id:store.row.id,slug:store.published.slug,published_at:'2026-11-01T12:00:00Z'}],schedules:[],role:'owner',email:'isolated-ui@example.invalid'};
  if(action==='save'){const body=route.request().postDataJSON();assert.equal(body.version,store.row.version);const snapshot=snapshotSchema.parse(body.snapshot);store.row={...store.row,draft:snapshot,version:store.row.version+1};store.saves++;result=store.row;}
  if(action==='revisions')result=[{id:id(999),version:1,snapshot:initial,created_at:'2026-11-01T12:00:00Z'}];
  if(action==='publish')store.published=structuredClone(store.row.draft);
  store.requests.push({action,status:200});await route.fulfill({json:result});
 });
}
const button=(p:Page,name:string)=>p.getByRole('button',{name,exact:true});
async function open(p:Page){await p.goto(base+'/admin/');await p.locator('.admin-post-row').getByRole('button',{name:'Editar',exact:true}).click();await p.getByRole('tab',{name:'Geral',exact:true}).click();}
async function dialog(p:Page,context='listing'){await p.locator(`[data-adjust-frame="${context}"]`).click();await expect(p.locator('.framing-editor')).toBeVisible();await p.locator('[data-frame-image]').evaluate((img:HTMLImageElement)=>img.decode());}
async function save(p:Page){await button(p,'Salvar agora').click();await expect(p.locator('#save-status')).toHaveText('Salvo');}
const control=(p:Page,name:string)=>p.locator(`[data-frame-control="${name}"]`);
async function keyboardValue(p:Page,name:string,value:'Home'|'End'|'ArrowRight'|'ArrowLeft'){await control(p,name).focus();await control(p,name).press(value);}
async function noOverflow(p:Page,label:string){
 const bounds=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dialog:(()=>{const d=document.querySelector<HTMLDialogElement>('#admin-dialog');return d?.open?{width:d.clientWidth,scroll:d.scrollWidth,left:d.getBoundingClientRect().left,right:d.getBoundingClientRect().right}:null;})()}));
 assert(bounds.scroll<=bounds.width+1,`${label}: page overflow ${JSON.stringify(bounds)}`);
 if(bounds.dialog)assert(bounds.dialog.scroll<=bounds.dialog.width+1&&bounds.dialog.left>=-1&&bounds.dialog.right<=bounds.width+1,`${label}: modal overflow ${JSON.stringify(bounds)}`);
}
async function coverContained(p:Page){
 const g=await p.locator('[data-frame-stage]').evaluate(stage=>{const a=stage.getBoundingClientRect(),b=stage.querySelector('img')!.getBoundingClientRect();return {left:b.left-a.left,top:b.top-a.top,right:b.right-a.right,bottom:b.bottom-a.bottom};});
 assert(g.left<=1&&g.top<=1&&g.right>=-1&&g.bottom>=-1,`Cover exposes an empty edge ${JSON.stringify(g)}`);
}
async function fullImageContained(p:Page){
 const g=await p.locator('[data-frame-stage]').evaluate(stage=>{const a=stage.getBoundingClientRect(),b=stage.querySelector('img')!.getBoundingClientRect();return {left:b.left-a.left,top:b.top-a.top,right:b.right-a.right,bottom:b.bottom-a.bottom,xc:b.x+b.width/2-a.x-a.width/2,yc:b.y+b.height/2-a.y-a.height/2};});
 assert(g.left>=-1&&g.top>=-1&&g.right<=1&&g.bottom<=1&&Math.abs(g.xc)<1&&Math.abs(g.yc)<1,`Contain crops or misaligns ${JSON.stringify(g)}`);
}
async function pick(p:Page,field:string,assetId:string){await p.locator(`[data-media-field="${field}"]`).click();await p.locator(`[data-pick="${assetId}"]`).click();}
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/admin/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,serverLog);
 for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']] as const){
  browser=await engine.launch(name==='chromium'?{channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}:{});
  const store:Store={row:{id:id(200),draft:structuredClone(initial),version:1,is_demo:true,updated_at:'2026-11-01T12:00:00Z'},published:structuredClone(initial),saves:0,requests:[]};
  const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce',hasTouch:true});await install(context,store);const p=await context.newPage();diagnostic=p;p.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
  await open(p);await dialog(p);await expect(control(p,'zoom')).toHaveValue('100');await expect(control(p,'x')).toHaveValue('50');await expect(control(p,'y')).toHaveValue('50');await coverContained(p);
  await keyboardValue(p,'zoom','End');await expect(control(p,'zoom')).toHaveValue('300');await keyboardValue(p,'zoom','Home');await expect(control(p,'zoom')).toHaveValue('100');await keyboardValue(p,'zoom','ArrowRight');assert(Number(await control(p,'zoom').inputValue())>100);
  const stage=await p.locator('[data-frame-stage]').boundingBox();assert(stage);const oldY=await control(p,'y').inputValue();await p.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);await p.mouse.down();await p.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2+40,{steps:8});await p.mouse.up();assert.notEqual(await control(p,'y').inputValue(),oldY);await coverContained(p);
  await keyboardValue(p,'zoom','End');await keyboardValue(p,'x','End');await keyboardValue(p,'y','End');await coverContained(p);await keyboardValue(p,'x','Home');await keyboardValue(p,'y','Home');await coverContained(p);
  await p.locator('[data-frame-reset]').click();await expect(control(p,'zoom')).toHaveValue('100');await expect(control(p,'y')).toHaveValue('50');
  await keyboardValue(p,'y','Home');await p.locator('[data-frame-context="compact"]').click();await p.locator('select[data-frame-mode]').selectOption('contain');for(const key of ['zoom','x','y'])await expect(control(p,key)).toBeDisabled();await fullImageContained(p);
  await p.locator('[data-frame-context="article"]').click();await keyboardValue(p,'y','Home');await coverContained(p);await p.locator('[data-frame-apply]').click();await expect(p.locator('#admin-dialog')).not.toBeVisible();await expect(p.locator('[data-adjust-frame="listing"]')).toBeFocused();await save(p);
  assert.equal(store.row.draft.imageFraming.listing.y,0);assert.equal(store.row.draft.imageFraming.compact.mode,'contain');assert.equal(store.row.draft.imageFraming.article.y,0);assert.deepEqual(store.published,initial,'Draft framing must not change publication');assert.deepEqual(store.row.draft.social,initial.social);const applied=structuredClone(store.row.draft.imageFraming);
  await open(p);await dialog(p);await expect(control(p,'y')).toHaveValue('0');await keyboardValue(p,'zoom','End');await p.locator('[data-frame-cancel]').click();await save(p);assert.deepEqual(store.row.draft.imageFraming,applied);
  await dialog(p);await keyboardValue(p,'y','End');await p.keyboard.press('Escape');await expect(p.locator('#admin-dialog')).not.toBeVisible();await save(p);assert.deepEqual(store.row.draft.imageFraming,applied);
  await dialog(p);await p.locator('[data-frame-reset]').click();await p.getByRole('button',{name:'Fechar',exact:true}).click();await save(p);assert.deepEqual(store.row.draft.imageFraming,applied);
  report.checks.push({engine:name,kind:'Legacy defaults; keyboard zoom; mouse drag; reset; three contexts; contain; apply/save/reload; cancel/Escape/close; draft and social isolation'});
  // A thumbnail owns listing/compact while the cover owns the article frame.
  await pick(p,'thumbnailId',assets[1].id);await save(p);assert.deepEqual(store.row.draft.imageFraming.article,applied.article);await dialog(p);await expect(control(p,'zoom')).toHaveValue('100');await expect(control(p,'x')).toHaveValue('50');await p.locator('select[data-frame-mode]').selectOption('contain');await p.locator('[data-frame-apply]').click();await save(p);const thumbnailFrame=structuredClone(store.row.draft.imageFraming.listing);
  await pick(p,'coverId',assets[2].id);await save(p);assert.deepEqual(store.row.draft.imageFraming.listing,thumbnailFrame);await dialog(p,'article');await expect(control(p,'zoom')).toHaveValue('100');await expect(control(p,'y')).toHaveValue('50');await p.locator('[data-frame-cancel]').click();
  await p.locator('[data-clear-media="thumbnailId"]').click();await save(p);await dialog(p);await expect(p.locator('select[data-frame-mode]')).toHaveValue('cover');await p.locator('[data-frame-cancel]').click();
  await pick(p,'coverId',assets[3].id);await save(p);await dialog(p,'article');await expect(p.locator('.framing-editor')).toContainText('200');await expect(p.locator('[data-frame-warning]')).toBeVisible();await coverContained(p);await p.locator('select[data-frame-mode]').selectOption('contain');await fullImageContained(p);await p.locator('[data-frame-apply]').click();await save(p);await p.locator('[data-clear-media="coverId"]').click();await save(p);await expect(p.locator('[data-adjust-frame]')).toHaveCount(0);
  assert.deepEqual(store.row.draft.social,initial.social);report.checks.push({engine:name,kind:'Independent thumbnail; cover/thumbnail replacement and removal reset only dependent contexts; square and small media'});
  await pick(p,'coverId',assets[0].id);await save(p);
  for(const width of [320,390,834,1366,2560]){
   await p.setViewportSize({width,height:width===1366?768:900});await noOverflow(p,`${name}/${width}/general`);await dialog(p);
   for(const frame of ['listing','compact','article']){await p.locator(`[data-frame-context="${frame}"]`).click();await keyboardValue(p,'y','Home');await noOverflow(p,`${name}/${width}/${frame}`);await coverContained(p);}
   if([390,834,1366].includes(width))await p.screenshot({path:`${output}/framing-${name}-${width}.png`,fullPage:false});
   await p.locator('[data-frame-cancel]').click();report.checks.push({engine:name,width,kind:'Three modal contexts and General layout'});
  }
  await p.setViewportSize({width:390,height:844});await p.addStyleTag({content:'html{font-size:200%}'});await noOverflow(p,`${name}/200/general`);await dialog(p);for(const frame of ['listing','compact','article']){await p.locator(`[data-frame-context="${frame}"]`).click();await noOverflow(p,`${name}/200/${frame}`);}await p.screenshot({path:`${output}/framing-${name}-390-200.png`,fullPage:false});await p.locator('[data-frame-cancel]').click();await p.reload();
  for(const dpr of [2,3]){
   const retina=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:dpr,hasTouch:true,reducedMotion:dpr===2?'reduce':'no-preference'});await install(retina,store);const rp=await retina.newPage();await open(rp);await dialog(rp);
   const image=rp.locator('[data-frame-image]');await image.evaluate((img:HTMLImageElement)=>img.decode());assert(await image.evaluate((img:HTMLImageElement)=>img.naturalWidth>0));await coverContained(rp);const box=await rp.locator('[data-frame-stage]').boundingBox();assert(box);const yBefore=await control(rp,'y').inputValue();
   if(name==='chromium'){
    const cdp=await retina.newCDPSession(rp);const x=box.x+box.width/2,y=box.y+box.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+32}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();assert.notEqual(await control(rp,'y').inputValue(),yBefore,'Native emulated touch must drag');
   }else{
    // Playwright WebKit has touch tap but no native touch-drag command. Verify tap and the accessible alternative.
    await rp.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await keyboardValue(rp,'y','ArrowRight');assert.notEqual(await control(rp,'y').inputValue(),yBefore);
   }
   await coverContained(rp);await rp.locator('[data-frame-cancel]').click();await retina.close();report.checks.push({engine:name,dpr,kind:name==='chromium'?'Emulated native touch drag':'Native touch tap and keyboard positioning; physical Safari touch drag not tested'});
  }
  await context.close();await browser.close();browser=undefined;
 }
 assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();console.log(`PASS: ${report.checks.length} isolated framing UI checks across Chromium and WebKit.`);
}catch(e){report.failure=(e as Error).stack;if(diagnostic)await diagnostic.screenshot({path:output+'/failure.png',fullPage:false}).catch(()=>{});throw e;}
finally{if(browser)await browser.close();child?.kill();await writeFile(output+'/report.json',JSON.stringify(report,null,2));await writeFile(output+'/server.log',serverLog);}
