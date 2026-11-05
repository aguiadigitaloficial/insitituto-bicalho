/** Team photo/name correspondence, native-resolution media, preserved copy and browser reflow. */
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {exiftool} from 'exiftool-vendored';
import assert from 'node:assert/strict';
import {team} from '../src/data/content';
import {media,photoCopyright,photoWidths,photoWidthAt} from '../src/data/photos';

const base=process.env.TEST_URL||'http://127.0.0.1:4326';
const expected=[
 ['Wanuza','Gerente','official-team-jm-wanuza','team-jm-20261104/photo-13.jpg','joao-monlevade'],
 ['Dra. Lívia Teixeira','Estética e Reabilitação oral','official-team-jm-livia-teixeira','team-jm-20261104/photo-12.jpg','joao-monlevade'],
 ['Irlam','Diretora Clínica e ASB','official-team-jm-irlam','team-jm-20261104/photo-11.jpg','joao-monlevade'],
 ['Iara','CRM','official-team-jm-iara','team-jm-20261104/photo-10.jpg','joao-monlevade'],
 ['Bianca','CRC','official-team-jm-bianca','team-jm-20261104/photo-09.jpg','joao-monlevade'],
 ['Eloiza','Auxiliar de saúde bucal','official-team-jm-eloiza','team-jm-20261104/photo-08.jpg','joao-monlevade'],
 ['Matheus Souza','Protético','official-team-jm-matheus-souza','team-jm-20261104/photo-07.jpg','joao-monlevade'],
 ['Jessica','Recepção','official-team-bh-jessica','team-bh-20261105/jessica.jpeg','belo-horizonte'],
 ['Dra. Veridiana Salles','Odontopediatra','official-team-bh-veridiana-salles','team-bh-20261105/veridiana-salles.jpeg','belo-horizonte'],
 ['Nicoly Santos','ABS','official-team-bh-nicoly-santos','team-bh-20261105/nicoly-santos.jpeg','belo-horizonte'],
 ['Dra. Luísa Lima','Reabilitação oral','official-team-bh-luisa-lima','team-bh-20261105/luisa-lima.jpeg','belo-horizonte'],
 ['Dra. Ana Luiza Perdigão','Odontopediatra','official-team-bh-ana-luiza-perdigao','team-bh-20261105/ana-luiza-perdigao.jpeg','belo-horizonte'],
 ['Alice','Financeiro','official-team-bh-alice','team-bh-20261105/alice.jpeg','belo-horizonte'],
]as const;
const fixture=JSON.parse(await readFile('scripts/fixtures/team-preserved-copy.json','utf8'));
const output='artifacts/team-catalog';await mkdir(output,{recursive:true});
const widths=[320,375,390,393,414,599,600,767,768,769,834,1023,1024,1199,1200,1201,1366,2560];
const report:any={base,startedAt:new Date().toISOString(),assets:[],checks:[],errors:[]};
assert.equal(team.length,23);assert.equal(new Set(team.map(p=>p.name)).size,23);
for(const old of fixture.previousTeam){const current=team.find(p=>p.name===old.name)!;assert(current);assert.equal(current.kind,old.kind);assert.equal(current.work,old.work);if(!['Dra. Lívia Teixeira','Dra. Veridiana Salles','Dra. Luísa Lima','Dra. Ana Luiza Perdigão'].includes(old.name))assert.equal(current.role,old.role);}

async function openTeam(page:Page){await page.goto(base+'/#equipe',{waitUntil:'domcontentloaded'});const refuse=page.getByRole('button',{name:'Recusar',exact:true});if(await refuse.isVisible())await refuse.click();await page.locator('#equipe-completa>summary').click();await expect(page.locator('#equipe-completa')).toHaveAttribute('open','');await page.evaluate(()=>document.fonts.ready);}
async function photoLoad(page:Page){for(const img of await page.locator('.team-portrait img').all()){await img.evaluate((image:HTMLImageElement)=>image.scrollIntoView({behavior:'instant',block:'center'}));await img.evaluate((image:HTMLImageElement)=>image.decode());}}
async function preservedCopy(page:Page){
 const outside=await page.evaluate(()=>({route:'/',title:document.title,description:document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content,canonical:document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href,robots:document.querySelector<HTMLMetaElement>('meta[name="robots"]')!.content,blocks:[...document.querySelectorAll('h1,h2,h3,p,a,button,address,summary,.eyebrow,.portrait-note')].filter(el=>!el.closest('.team-person')&&!el.closest('[data-service-contact]')&&!(el.matches('a[href="/conteudos/"]')&&el.textContent!.trim()==='Blog'&&el.closest('.site-header,.site-footer'))).map(el=>({tag:el.tagName,text:el.textContent!.replace(/\s+/g,' ').trim()}))}));
 await writeFile(output+'/copy-outside-actual.json',JSON.stringify(outside,null,2));
 assert.equal(outside.blocks.length,fixture.homeOutsideTeam.blocks);
 assert.equal(createHash('sha256').update(JSON.stringify(outside).replace(/© \d{4}/g,'© {year}')).digest('hex'),fixture.homeOutsideTeam.sha256,'Every Home word outside the approved team update must remain identical');
}

async function catalogLayout(page:Page,engine:string,width:number,scale:number){
 const layout=await page.evaluate(()=>{
  const grid=document.querySelector('.team-catalog')!,gridStyle=getComputedStyle(grid),rootSize=parseFloat(getComputedStyle(document.documentElement).fontSize);
  const cards=[...grid.querySelectorAll('.team-person')].map(card=>{
   const style=getComputedStyle(card),box=card.getBoundingClientRect().toJSON(),heading=card.querySelector('.team-person-heading')!,identity=card.querySelector('.team-person-identity')!,photo=card.querySelector('.team-portrait'),description=card.querySelector('p'),h3=card.querySelector('h3')!;
   const content={left:box.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),right:box.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight),top:box.top+parseFloat(style.borderTopWidth)+parseFloat(style.paddingTop),bottom:box.bottom-parseFloat(style.borderBottomWidth)-parseFloat(style.paddingBottom)};
   const brokenWords:string[]=[];const walker=document.createTreeWalker(h3,NodeFilter.SHOW_TEXT);let node:Node|null;
   while((node=walker.nextNode()))for(const word of node.textContent!.matchAll(/\S+/g)){const range=document.createRange();range.setStart(node,word.index!);range.setEnd(node,word.index!+word[0].length);const lines=new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top)));if(lines.size>1)brokenWords.push(word[0]);}
   return {name:h3.textContent,box,content,background:style.backgroundColor,borders:[style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth],radius:parseFloat(style.borderRadius),padding:parseFloat(style.paddingLeft),heading:heading.getBoundingClientRect().toJSON(),identity:identity.getBoundingClientRect().toJSON(),photo:photo?{...photo.getBoundingClientRect().toJSON(),radius:parseFloat(getComputedStyle(photo).borderRadius)}:null,description:description?{...description.getBoundingClientRect().toJSON(),border:parseFloat(getComputedStyle(description).borderTopWidth)}:null,children:[heading,identity,h3,...card.querySelectorAll('.team-role'),...(photo?[photo]:[]),...(description?[description]:[])].map(el=>el.getBoundingClientRect().toJSON()),brokenWords,fontSize:parseFloat(getComputedStyle(h3).fontSize)};
  });
  return {overflow:document.documentElement.scrollWidth>innerWidth+1,columns:gridStyle.gridTemplateColumns.split(' ').length,gridWidth:grid.getBoundingClientRect().width,gap:parseFloat(gridStyle.columnGap),rootSize,cards};
 });
 const label=`${engine}/${width}/${scale}`,tolerance=1.1;
 assert(!layout.overflow,`${label}: horizontal overflow`);
 const breakpointColumns=width>=1200?3:width>=768?2:1;
 const fittingColumns=Math.max(1,Math.floor((layout.gridWidth+layout.gap+.1)/(20*layout.rootSize+layout.gap)));
 assert.equal(layout.columns,Math.min(breakpointColumns,fittingColumns),`${label}: catalogue columns must fit the readable minimum`);
 assert(Math.abs(layout.gap-layout.rootSize)<tolerance,`${label}: consistent catalogue gutter`);
 for(const card of layout.cards){
  const personLabel=`${label}/${card.name}`;
  assert.equal(card.background,'rgb(255, 255, 255)',`${personLabel}: bounded white profile`);
  assert(card.borders.every(border=>parseFloat(border)===1),`${personLabel}: profile border on all sides`);
  assert(Math.abs(card.radius-layout.rootSize)<tolerance,`${personLabel}: profile radius`);
  assert(Math.abs(card.padding-Math.min((width>=600?1:.75)*layout.rootSize,width*.0375))<tolerance,`${personLabel}: profile inset leaves room for enlarged names`);
  assert(Math.abs(card.fontSize-1.125*layout.rootSize)<tolerance,`${personLabel}: readable name size`);
  assert.deepEqual(card.brokenWords,[],`${personLabel}: names must not split inside a word`);
  assert(card.children.every(child=>child.left>=card.content.left-tolerance&&child.right<=card.content.right+tolerance&&child.top>=card.content.top-tolerance&&child.bottom<=card.content.bottom+tolerance),`${personLabel}: all content contained by the profile padding`);
  if(card.photo){
   const targetWidth=(width>=600?6:5)*layout.rootSize,availableWidth=card.content.right-card.content.left;
   assert(Math.abs(card.photo.width-Math.min(targetWidth,availableWidth))<tolerance,`${personLabel}: compact portrait fits its available space`);
   assert(Math.abs(card.photo.width/card.photo.height-.8)<.005,`${personLabel}: portrait proportion preserved`);
   assert(Math.abs(card.photo.radius-layout.rootSize)<tolerance,`${personLabel}: portrait radius`);
   if(card.identity.left>=card.photo.right-tolerance)assert(Math.abs((card.identity.top+card.identity.bottom-card.photo.top-card.photo.bottom)/2)<tolerance,`${personLabel}: identity vertically aligned with photograph`);
   else assert(card.identity.top>=card.photo.bottom-tolerance,`${personLabel}: reflow stacks identity below photograph without overlap`);
  }
  if(card.description){assert(card.description.border>=1,`${personLabel}: clinical details have a divider`);assert(card.description.top>=card.heading.bottom-tolerance,`${personLabel}: clinical details below the identity`);}
 }
 const rows=new Map<number,typeof layout.cards>();
 for(const card of layout.cards){const row=[...rows.keys()].find(y=>Math.abs(y-card.box.top)<tolerance)??card.box.top;rows.set(row,[...(rows.get(row)||[]),card]);}
 for(const row of rows.values()){
  assert(row.every(card=>Math.abs(card.box.bottom-row[0].box.bottom)<tolerance),`${label}: equal profile boundaries within each row`);
  for(let i=1;i<row.length;i++)assert(row[i].box.left>=row[i-1].box.right+layout.gap-tolerance,`${label}: profiles do not overlap`);
 }
 report.checks.push({engine,width,scale,columns:layout.columns,profiles:layout.cards.length,contained:true,unbrokenNames:true,alignedRows:true});
}

try{
 if(process.argv.includes('--assets')){
  const originals=JSON.parse(await readFile('assets/originals/team-jm-20261104/manifest.json','utf8'));
  const bhOriginals=JSON.parse(await readFile('assets/originals/team-bh-20261105/manifest.json','utf8'));
  for(const [name,,src,originalPath,unit]of expected){
   const member=team.find(p=>p.name===name)!;const photo=media[member.photo!];assert.equal(photo.src,src);assert.equal(photo.original,originalPath);
   const original=await readFile('assets/originals/'+photo.original);assert.equal(createHash('sha256').update(original).digest('hex'),(unit==='joao-monlevade'?originals.find((p:any)=>p.photo===Number(originalPath.match(/photo-(\d+)/)![1])):bhOriginals.find((p:any)=>originalPath.endsWith('/'+p.path))).sha256);
   const native=await sharp(original).metadata();assert.deepEqual([native.width,native.height],[photo.width,photo.height]);assert(photoWidths(photo).every(w=>w<=native.width!));assert.equal(photoWidthAt(photo,1200),photo.width);
   for(const width of photoWidths(photo))for(const format of ['webp','avif']){const file=`public/assets/${src}-${width}.${format}`;const m=await sharp(file).metadata(),tags=await exiftool.read(file);assert.equal(m.width,width);assert.equal(tags.Copyright,photoCopyright);assert.equal(tags.Rights,photoCopyright);assert(JSON.stringify(tags.Title).includes(name));assert.equal(tags.GPSLatitude,undefined);report.assets.push({name,width,format,copyright:true});}
  }
  assert(originals.slice(0,6).every((p:any)=>p.name===null&&p.status==='awaiting-identification'));
  assert(!Object.values(media).some(p=>/^team-jm-20261104\/photo-0[1-6]\.jpg$/.test(p.original)));
 }
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]as const){
  const browser=await engine.launch(name==='chromium'?{channel:'chrome'}:{});
  const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(name+': '+e.message));
  try{
   await openTeam(page);await preservedCopy(page);await expect(page.locator('.team-person')).toHaveCount(23);await expect(page.locator('.team-portrait')).toHaveCount(13);await expect(page.locator('img[src*="official-team-meeting"]')).toHaveCount(0);
   await expect(page.locator('#equipe-completa .team-grid')).toHaveCount(1);
   await expect(page.locator('.team-catalog>.team-person')).toHaveCount(23);
   assert.deepEqual(await page.locator('.team-catalog h3').allTextContents(),[...expected.map(p=>p[0]),...team.filter(p=>!p.photo).map(p=>p.name)]);
   for(const person of team){
    const card=page.locator('.team-person').filter({has:page.getByRole('heading',{name:person.name,exact:true})});
    await expect(card).toHaveCount(1);
    if(person.role)await expect(card.locator('.team-role')).toHaveText(person.role);else await expect(card.locator('.team-role')).toHaveCount(0);
    if(person.kind||person.work){
     if(person.kind)await expect(card.locator('.team-kind')).toHaveText(person.kind);
     assert.equal(await card.locator('p').evaluate(p=>{const copy=p.cloneNode(true)as HTMLElement;copy.querySelector('.team-kind')?.remove();return copy.textContent!.replace(/\s+/g,' ').trim();}),person.work);
    }else await expect(card.locator('p')).toHaveCount(0);
   }
   for(const [person,role,src,,unit]of expected){const card=page.locator('.team-person').filter({has:page.getByRole('heading',{name:person,exact:true})});await expect(card).toHaveCount(1);await expect(card.locator('.team-role')).toHaveText(role);await expect(card).toHaveAttribute('data-unit',unit);await expect(card.locator('img')).toHaveAttribute('src',new RegExp(src));await expect(card.locator('img')).toHaveAttribute('alt',new RegExp(person.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
   for(const old of fixture.previousTeam){const card=page.locator('.team-person').filter({has:page.getByRole('heading',{name:old.name,exact:true})});await expect(card).toHaveCount(1);await expect(card.locator('.team-kind')).toHaveText(old.kind);await expect(card.locator('p')).toContainText(old.work);if(old.role&&!['Dra. Luísa Lima','Dra. Veridiana Salles'].includes(old.name))await expect(card.locator('.team-role')).toHaveText(old.role);}
   for(const width of widths)for(const scale of [100,200]){
    await page.setViewportSize({width,height:width===1366?768:900});await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
    await catalogLayout(page,name,width,scale);
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='');
   for(const width of [390,834,1366]){await page.setViewportSize({width,height:900});await photoLoad(page);await page.locator('#equipe-completa').screenshot({path:`${output}/team-${width}-${name}.png`,animations:'disabled',style:'.site-header,.assistant-launcher,.skip-link,.mobile-cta,.cookie-notice{visibility:hidden!important}'});}
   await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.body.dataset.motion==='ready');await page.locator('#equipe-completa>summary').focus();await page.locator('#equipe-completa>summary').press('Enter');await expect(page.locator('#equipe-completa')).not.toHaveAttribute('open','');await page.locator('#equipe-completa>summary').press('Enter');await expect(page.locator('#equipe-completa')).toHaveAttribute('open','');await expect(page.locator('.team-person').last()).toBeVisible();await page.locator('#equipe-completa>summary').press('Enter');await expect(page.locator('#equipe-completa')).not.toHaveAttribute('open','');
   for(const dpr of [2,3])for(const width of [390,834,1366]){
    const high=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:dpr,reducedMotion:'reduce'});const p=await high.newPage();await openTeam(p);await photoLoad(p);
    const photos=await p.locator('.team-portrait img').evaluateAll((imgs:HTMLImageElement[])=>imgs.map(img=>({src:img.currentSrc,native:Number(img.getAttribute('width')),selected:Number(img.currentSrc.match(/-(\d+)\.(?:webp|avif)/)?.[1]),needed:img.clientWidth*devicePixelRatio})));
    assert(photos.every(p=>p.selected<=p.native&&p.selected>=Math.min(p.needed,p.native)*.98),`${name}/${width}/${dpr}: insufficient portrait resolution`);report.checks.push({engine:name,width,dpr,images:photos.length});await high.close();
   }
   const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});const p=await nojs.newPage();await p.goto(base+'/');await p.locator('#equipe-completa>summary').focus();await p.locator('#equipe-completa>summary').press('Enter');await expect(p.locator('#equipe-completa')).toHaveAttribute('open','');await photoLoad(p);
   for(const img of await p.locator('.team-portrait img').all()){const src=await img.getAttribute('src');assert(src&&!src.includes('-1200.'));assert.equal((await p.request.get(base+src)).status(),200);}
   await expect(p.locator('.team-catalog>.team-person')).toHaveCount(23);
   assert.deepEqual(await p.locator('.team-catalog h3').allTextContents(),[...expected.map(person=>person[0]),...team.filter(person=>!person.photo).map(person=>person.name)]);
   await nojs.close();console.log('PASS: '+name+` — catalogue/photos/names, ${widths.length*2} reflow cases, 2x/3x, no-JavaScript fallback and team toggle.`);
  }finally{await context.close();await browser.close();}
 }
 assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();
}catch(error){report.failure=(error as Error).message;throw error;}
finally{await exiftool.end();await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
