import {chromium,webkit,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {areas,units} from '../src/data/content';
import {normalizeContactPhone,serviceContactUrl} from '../src/lib/service-contact';

const base=process.env.TEST_URL||'http://127.0.0.1:4321';
const out='artifacts/service-contact';await mkdir(out,{recursive:true});
for(const value of ['(31) 99999-1234','31999991234','+55 (31) 99999-1234','55 31 99999-1234'])assert.equal(normalizeContactPhone(value),'31999991234');
assert.equal(normalizeContactPhone('31 3333-1234'),'3133331234');
for(const value of ['','123','+1 (31) 99999-1234','31 abc 9999-1234','11111111111','031999991234'])assert.equal(normalizeContactPhone(value),null,value);
assert.throws(()=>serviceContactUrl({name:'',phone:'31999991234',interest:'Tratamentos',unit:'João Monlevade',recipient:'5531992957448',page:'Tratamentos'}));
const checks:any[]=[],violations:any[]=[],errors:string[]=[];
const widthCases=[320,375,390,393,414,768,834,1024,1366,2560].map(width=>({width,scale:1})).concat([320,393,834,1366].map(width=>({width,scale:2})));
async function stepCheck(page:Page,step:number,engine:string,route:string,width:number,scale:number){
 const state=await page.locator('[data-service-contact]').evaluate(section=>{
  const frame=section.getBoundingClientRect();
  const focused=document.activeElement?.getBoundingClientRect();
  const controls=[...section.querySelectorAll<HTMLElement>('input,button,a,fieldset')].filter(el=>el.getClientRects().length>0);
  return {overflow:document.documentElement.scrollWidth>innerWidth+1,frame:[frame.left,frame.right],focusVisible:!!focused&&focused.bottom>0&&focused.top<innerHeight,outside:controls.filter(el=>{const b=el.getBoundingClientRect();return b.left<-.5||b.right>innerWidth+.5;}).map(el=>el.outerHTML.slice(0,120)),tiny:controls.filter(el=>parseFloat(getComputedStyle(el).fontSize)<14&&el.tagName!=='INPUT').map(el=>el.tagName),visiblePanels:[...section.querySelectorAll<HTMLElement>('[data-contact-step]')].filter(el=>el.getClientRects().length>0).map(el=>el.dataset.contactStep)};
 });
 assert(!state.overflow,`${engine} ${route} ${width}/${scale}: horizontal overflow`);
 assert.deepEqual(state.outside,[],`${engine} ${route} ${width}/${scale}: clipped controls`);
 assert.deepEqual(state.visiblePanels,[String(step)]);
 assert.deepEqual(state.tiny,[]);
 if(step>0)assert(state.focusVisible,`${engine} ${route} ${width}/${scale}: focused control outside viewport`);
 checks.push({engine,route,width,scale,step});
}
for(const [engine,driver] of Object.entries({chromium,webkit})){
 const browser=await driver.launch(engine==='chromium'?{channel:'chrome'}:{});
 try{
  const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();
  page.on('pageerror',e=>errors.push(`${engine}: ${e.message}`));
  for(const [caseIndex,{width,scale}] of widthCases.entries()){
   await page.setViewportSize({width,height:width===1366?768:width<600?844:1000});
   for(const [areaIndex,area] of areas.entries()){
    const route=`/${area.slug}/`;
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});assert.equal(response?.status(),200);
    await page.evaluate(()=>document.fonts.ready);
    if(scale===2)await page.addStyleTag({content:'html{font-size:200% !important}'});
    const section=page.locator('[data-service-contact]');assert.equal(await section.count(),1);
    await section.locator('[data-contact-widget]').waitFor({state:'visible'});
    assert.equal(await section.locator('input[name=interest]:checked').inputValue(),area.title);
    await section.scrollIntoViewIfNeeded();
    await stepCheck(page,0,engine,route,width,scale);
    if(caseIndex===0){
     await section.getByRole('button',{name:'Continuar',exact:true}).click();
     assert.match(await section.locator('[role=alert]').innerText(),/Digite seu nome/);
     assert.equal(await section.locator('[name=name]').getAttribute('aria-invalid'),'true');
    }
    await section.getByLabel('Seu nome',{exact:true}).fill('Pessoa de teste Bicalho');
    await section.getByRole('button',{name:'Continuar',exact:true}).click();
    await stepCheck(page,1,engine,route,width,scale);
    if(caseIndex===0){
     await section.getByLabel('WhatsApp com DDD',{exact:true}).fill('123');
     await section.getByRole('button',{name:'Continuar',exact:true}).click();
     assert.match(await section.locator('[role=alert]').innerText(),/telefone brasileiro/);
    }
    await section.getByLabel('WhatsApp com DDD',{exact:true}).fill('+55 (31) 99999-1234');
    await section.getByRole('button',{name:'Continuar',exact:true}).click();
    await stepCheck(page,2,engine,route,width,scale);
    await section.getByRole('button',{name:'Continuar',exact:true}).click();
    await stepCheck(page,3,engine,route,width,scale);
    if(caseIndex===0){
     await section.getByRole('button',{name:'Continuar',exact:true}).click();
     assert.match(await section.locator('[role=alert]').innerText(),/Escolha a unidade/);
    }
    const unit=units[(caseIndex+areaIndex)%units.length];
    await section.getByLabel(unit.name,{exact:true}).check();
    await section.getByRole('button',{name:'Continuar',exact:true}).click();
    await stepCheck(page,4,engine,route,width,scale);
    const href=await section.getByRole('link',{name:'Continuar no WhatsApp',exact:true}).getAttribute('href');
    const url=new URL(href!);assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,`/${unit.phone}`);
    const text=url.searchParams.get('text')!;for(const phrase of ['Pessoa de teste Bicalho','+55 (31) 99999-1234',`Serviço de interesse: ${area.title}`,`Unidade: ${unit.name}`,`Página de origem: ${area.title}`])assert(text.includes(phrase),phrase);
    assert(!text.includes('utm_'));assert.equal(await section.locator('[data-contact-send]').getAttribute('rel'),'noopener noreferrer');
    assert.equal(await section.locator('[data-contact-send]').getAttribute('data-whatsapp'),unit.id);
    if(caseIndex===0){
     await section.getByRole('button',{name:'Voltar',exact:true}).click();
     const other=units.find(u=>u.id!==unit.id)!;await section.getByLabel(other.name,{exact:true}).check();
     await section.getByRole('button',{name:'Continuar',exact:true}).click();
     assert(new URL((await section.locator('[data-contact-send]').getAttribute('href'))!).pathname===`/${other.phone}`);
     for(let n=0;n<4;n++)await section.getByRole('button',{name:'Voltar',exact:true}).click();
     assert.equal(await section.getByLabel('Seu nome',{exact:true}).inputValue(),'Pessoa de teste Bicalho');
     const audit=await new AxeBuilder({page}).include('[data-service-contact]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
     violations.push(...audit.violations.map(v=>({engine,route,id:v.id,nodes:v.nodes.map(n=>n.target)})));
    }
    if(engine==='chromium'&&areaIndex===0&&[393,834,1366].includes(width)&&scale===1){
     for(let n=0;n<4;n++)if(await section.locator('[data-contact-back]').isVisible())await section.locator('[data-contact-back]').click();
     await section.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/form-${width}.png`,fullPage:false});
    }
   }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.goto(base+'/tratamentos/#agendamento',{waitUntil:'load'});
  await page.waitForFunction(()=>{const b=document.querySelector('[data-service-contact]')!.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0;});
  const flow=page.locator('[data-service-contact]');
  await flow.getByLabel('Seu nome',{exact:true}).fill('Pessoa de teste Bicalho');await flow.locator('[data-contact-next]').click();
  await flow.getByLabel('WhatsApp com DDD',{exact:true}).fill('31999991234');await flow.locator('[data-contact-next]').click();await flow.locator('[data-contact-next]').click();
  await flow.getByLabel(units[0].name,{exact:true}).check();await flow.locator('[data-contact-next]').click();
  await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/html',body:'Fluxo de teste. Nenhuma mensagem enviada.'}));
  const opened=context.waitForEvent('page');await flow.locator('[data-contact-send]').click();const popup=await opened;await popup.waitForLoadState('domcontentloaded');
  assert(new URL(popup.url()).pathname===`/${units[0].phone}`);await popup.close();
  assert(!JSON.stringify(await context.storageState()).includes('Pessoa de teste Bicalho'));
  for(const route of ['/','/contato/']){await page.goto(base+route);assert.equal(await page.locator('[data-service-contact]').count(),0);}
  await context.close();
  const noJs=await browser.newContext({javaScriptEnabled:false});const fallback=await noJs.newPage();await fallback.goto(base+'/tratamentos/');
  assert(await fallback.locator('[data-contact-widget]').isHidden());
  for(const unit of units)assert((await fallback.locator(`[data-contact-fallback] a[data-whatsapp="${unit.id}"]`).getAttribute('href'))?.startsWith(`https://wa.me/${unit.phone}`));
  await noJs.close();
 }finally{await browser.close();}
}
assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
await writeFile(`${out}/report.json`,JSON.stringify({base,checks,violations,errors,noJavaScript:true,phoneValidation:true},null,2));
console.log(`PASS: ${checks.length} form states in Chromium/WebKit, four service pages, both units, 100%/200%, phone validation, back navigation, accessibility and no-JS fallback.`);
