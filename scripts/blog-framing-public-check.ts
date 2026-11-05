import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,type Page} from '@playwright/test';
const base=process.env.BLOG_TEST_BASE||'http://127.0.0.1:4329';
const article='/conteudos/instituto-bicalho-joao-monlevade-belo-horizonte/';
const dir='artifacts/blog-framing/public';await mkdir(dir,{recursive:true});
const report:any={base,at:new Date().toISOString(),checks:[],errors:[]};
async function audit(p:Page){
 await p.evaluate(()=>document.fonts.ready);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
 const actions=await p.locator('.blog-search .button,.blog-message>.button').evaluateAll(es=>es.map(el=>{const b=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);const t=range.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,dx:(t.left+t.right-b.left-b.right)/2,dy:(t.top+t.bottom-b.top-b.bottom)/2,left:s.paddingLeft,right:s.paddingRight,height:b.height};}));
 for(const a of actions){assert.equal(a.left,a.right);assert(Math.abs(a.dx)<1&&Math.abs(a.dy)<2,JSON.stringify(a));assert(a.height>=52);}
 return actions;
}
try{for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']] as const){
 const browser=await engine.launch(name==='chromium'?{channel:'chrome'}:{});
 try{
  const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const path of ['/conteudos/',article,'/conteudos/busca/?q=Bicalho','/conteudos/ausente-enquadramento/']){
   await page.goto(base+path);
   for(const width of [320,375,390,393,414,599,600,768,834,1024,1199,1200,1366,1920,2560]){await page.setViewportSize({width,height:width===1366?768:900});report.checks.push({engine:name,path,width,actions:await audit(page)});}
   await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%}'});await audit(page);
  }
  for(const path of ['/conteudos/',article]){await page.goto(base+path);for(const width of [390,834,1366]){await page.setViewportSize({width,height:1000});const section=page.locator(path===article?'.article-opening':'.blog-featured');await section.locator('img').evaluateAll((es:HTMLImageElement[])=>Promise.all(es.map((im:HTMLImageElement)=>{im.loading='eager';return im.decode();})));await section.screenshot({path:`${dir}/${path===article?'article':'featured'}-${width}-${name}.png`});}}
  for(const dpr of [2,3])for(const width of [390,834,1366]){
   const retina=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:dpr});const rp=await retina.newPage();
   for(const path of ['/conteudos/',article]){
    await rp.goto(base+path);await rp.locator('.blog-photo img').evaluateAll((es:HTMLImageElement[])=>Promise.all(es.map((im:HTMLImageElement)=>{im.loading='eager';return im.decode();})));await rp.waitForTimeout(100);
    const images=await rp.locator('.blog-photo img').evaluateAll((es:HTMLImageElement[])=>es.map((im:HTMLImageElement)=>{const candidates=im.srcset.split(',').map(s=>({url:s.trim().split(/\s+/)[0],w:Number(s.match(/(\d+)w/)?.[1])}));const picture=im.closest('picture')!;const sources=picture.querySelectorAll('source');for(const source of sources)for(const item of source.srcset.split(','))candidates.push({url:item.trim().split(/\s+/)[0],w:Number(item.match(/(\d+)w/)?.[1])});return {selected:candidates.find(c=>im.currentSrc===new URL(c.url,location.href).href)?.w,max:Math.max(...candidates.map(c=>c.w||0)),required:im.getBoundingClientRect().width*devicePixelRatio,src:im.currentSrc,width:im.getBoundingClientRect().width,height:im.getBoundingClientRect().height,aspect:im.width/im.height,natural:im.naturalWidth/im.naturalHeight};}));
    for(const im of images){assert(im.selected&&im.selected>=Math.min(im.required,im.max)*.97,JSON.stringify({name,dpr,viewportWidth:width,path,...im}));assert(Math.abs(im.width/im.height-im.natural)<.01,'Distorted image');}report.checks.push({engine:name,path,width,dpr,images:images.length});
   }await retina.close();
  }
  await page.goto(base+'/conteudos/');const input=page.locator('.blog-search input').first();await input.fill('Bicalho');await input.press('Enter');await page.waitForURL('**/conteudos/busca/**');assert.equal(new URL(page.url()).searchParams.get('q'),'Bicalho');await page.goto(base+article);await page.locator('.blog-search input').fill('planejamento');await page.locator('.blog-search .button').click();await page.waitForURL('**/conteudos/busca/**');assert.equal(new URL(page.url()).searchParams.get('q'),'planejamento');
  const nojs=await browser.newContext({javaScriptEnabled:false});const np=await nojs.newPage();for(const path of ['/conteudos/',article]){await np.goto(base+path);assert(await np.locator('.blog-photo').count()>0);await audit(np);await np.locator('.blog-photo img').first().evaluate((im:HTMLImageElement)=>im.decode());}await nojs.close();
  report.checks.push({engine:name,search:'Enter and button navigation',noJavaScript:true});
 }finally{await browser.close();}
}assert.deepEqual(report.errors,[]);report.success=true;console.log(`PASS: ${report.checks.length} hosted/public framing and button checks.`);
}catch(e){report.failure=(e as Error).message;throw e;}finally{await writeFile(dir+'/report.json',JSON.stringify(report,null,2));}

