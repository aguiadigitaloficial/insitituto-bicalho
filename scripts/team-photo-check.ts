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
const output='artifacts/team-bh-compact';await mkdir(output,{recursive:true});
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
   assert.deepEqual(await page.locator('.team-portraits h3').allTextContents(),expected.map(p=>p[0]));
   for(const [person,role,src,,unit]of expected){const card=page.locator('.team-person').filter({has:page.getByRole('heading',{name:person,exact:true})});await expect(card).toHaveCount(1);await expect(card.locator('.team-role')).toHaveText(role);await expect(card).toHaveAttribute('data-unit',unit);await expect(card.locator('img')).toHaveAttribute('src',new RegExp(src));await expect(card.locator('img')).toHaveAttribute('alt',new RegExp(person.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
   for(const old of fixture.previousTeam){const card=page.locator('.team-person').filter({has:page.getByRole('heading',{name:old.name,exact:true})});await expect(card).toHaveCount(1);await expect(card.locator('.team-kind')).toHaveText(old.kind);await expect(card.locator('p')).toContainText(old.work);if(old.role&&!['Dra. Luísa Lima','Dra. Veridiana Salles'].includes(old.name))await expect(card.locator('.team-role')).toHaveText(old.role);}
   for(const width of [320,375,390,393,414,599,600,768,834,1023,1024,1199,1200,1366,2560])for(const scale of [100,200]){
    await page.setViewportSize({width,height:width===1366?768:900});await page.evaluate(s=>document.documentElement.style.fontSize=s+'%',scale);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,columns:getComputedStyle(document.querySelector('.team-portraits')!).gridTemplateColumns.split(' ').length,portraits:[...document.querySelectorAll('.team-portrait')].map(p=>{const r=p.getBoundingClientRect();return {ratio:r.width/r.height,radius:getComputedStyle(p).borderRadius,width:r.width,height:r.height};})}));
    assert(!layout.overflow,`${name}/${width}/${scale}: horizontal overflow`);assert.equal(layout.columns,width>=1200?3:width>=600?2:1);assert(layout.portraits.every(p=>Math.abs(p.ratio-.8)<.005&&p.radius===`${16*scale/100}px`&&Math.abs(p.width-(width>=600?96:80)*scale/100)<1&&Math.abs(p.height-(width>=600?120:100)*scale/100)<1));report.checks.push({engine:name,width,scale,columns:layout.columns});
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='');
   for(const width of [390,834,1366]){await page.setViewportSize({width,height:900});await photoLoad(page);await page.locator('.team-portraits').screenshot({path:`${output}/team-${width}-${name}.png`,animations:'disabled',style:'.site-header,.assistant-launcher,.skip-link,.mobile-cta,.cookie-notice{visibility:hidden!important}'});}
   await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.body.dataset.motion==='ready');await page.locator('#equipe-completa>summary').focus();await page.locator('#equipe-completa>summary').press('Enter');await expect(page.locator('#equipe-completa')).not.toHaveAttribute('open','');await page.locator('#equipe-completa>summary').press('Enter');await expect(page.locator('#equipe-completa')).toHaveAttribute('open','');await expect(page.locator('.team-person').last()).toBeVisible();await page.locator('#equipe-completa>summary').press('Enter');await expect(page.locator('#equipe-completa')).not.toHaveAttribute('open','');
   for(const dpr of [2,3])for(const width of [390,834,1366]){
    const high=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:dpr,reducedMotion:'reduce'});const p=await high.newPage();await openTeam(p);await photoLoad(p);
    const photos=await p.locator('.team-portrait img').evaluateAll((imgs:HTMLImageElement[])=>imgs.map(img=>({src:img.currentSrc,native:Number(img.getAttribute('width')),selected:Number(img.currentSrc.match(/-(\d+)\.(?:webp|avif)/)?.[1]),needed:img.clientWidth*devicePixelRatio})));
    assert(photos.every(p=>p.selected<=p.native&&p.selected>=Math.min(p.needed,p.native)*.98),`${name}/${width}/${dpr}: insufficient portrait resolution`);report.checks.push({engine:name,width,dpr,images:photos.length});await high.close();
   }
   const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});const p=await nojs.newPage();await p.goto(base+'/');await p.locator('#equipe-completa>summary').focus();await p.locator('#equipe-completa>summary').press('Enter');await expect(p.locator('#equipe-completa')).toHaveAttribute('open','');await photoLoad(p);
   for(const img of await p.locator('.team-portrait img').all()){const src=await img.getAttribute('src');assert(src&&!src.includes('-1200.'));assert.equal((await p.request.get(base+src)).status(),200);}
   await nojs.close();console.log('PASS: '+name+' — photos/names, 30 reflow cases, 2x/3x, no-JavaScript fallback and team toggle.');
  }finally{await context.close();await browser.close();}
 }
 assert.deepEqual(report.errors,[]);report.completedAt=new Date().toISOString();
}catch(error){report.failure=(error as Error).message;throw error;}
finally{await exiftool.end();await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
