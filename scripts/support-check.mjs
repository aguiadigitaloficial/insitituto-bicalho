import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
await page.goto(base+'/?utm_source=test&utm_campaign=preview');
const dialog=page.locator('#support-dialog');const actions=page.locator('#support-actions');
const choose=async name=>actions.getByRole('button',{name,exact:true}).click();
const reset=async()=>dialog.locator('[data-support-reset]').click();
const checkMessage=async(unit,phrase)=>{
 const href=await actions.locator('[data-whatsapp]').getAttribute('href');const url=new URL(href);
 assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,unit==='BH'?'/5531997954111':'/5531992957448');
 assert(url.searchParams.get('text').includes(phrase));assert(!href.includes('utm_'));
};
await page.locator('#primary-booking').click();
assert.equal(await page.locator('#booking-dialog [data-online-booking]').count(),0);
assert.equal(await page.locator('[data-booking-units] [data-whatsapp]').count(),2);
assert(await page.locator('[data-booking-units]').isVisible());await page.keyboard.press('Escape');
await page.locator('.assistant-launcher').click();assert(await dialog.isVisible());assert(await page.locator('.assistant-launcher').isHidden());assert(await page.locator('.mobile-cta').isHidden());
const a11y=[];
a11y.push({stage:'start',violations:(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations});
await choose('Quero agendar');await choose('João Monlevade');assert.equal(await actions.locator('[data-online-booking]').count(),0);await checkMessage('JM','Quero agendar');
await choose('Trocar unidade');await choose('Belo Horizonte');assert.equal(await actions.locator('[data-online-booking]').count(),0);await checkMessage('BH','Quero agendar');
await page.locator('#support-note').fill('<script>alert(1)</script> Minha observação.');await checkMessage('BH','Minha observação.');assert.equal(await actions.locator('script').count(),0);
const before=await page.locator('#support-history').innerText();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.assistant-launcher')===document.activeElement);await page.locator('.assistant-launcher').click();assert.equal(await page.locator('#support-history').innerText(),before);assert((await page.locator('#support-note').inputValue()).includes('Minha observação'));
await choose('Trocar unidade');await choose('João Monlevade');await checkMessage('JM','Minha observação');
a11y.push({stage:'review',violations:(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations});
await reset();assert.equal(await page.locator('#support-note').count(),0);assert.equal(await page.locator('.chat-visitor').count(),0);
const cases=[];
for(const area of ['Tratamentos','Estética','Ortodontia e Cirurgia','Odontologia de Precisão']){
 await reset();await choose('Tenho dúvidas');await choose('Tratamentos');await choose(area);
 const services=await actions.getByRole('button').allTextContents();
 for(const service of services){
  await choose(service);const answer=await page.locator('#support-history .chat-assistant').last().innerText();assert(answer.length>60);
  await choose('Continuar com a equipe');await choose('Belo Horizonte');await checkMessage('BH',service);
  cases.push({area,service});
  await dialog.locator('[data-support-back]').click();await dialog.locator('[data-support-back]').click();await dialog.locator('[data-support-back]').click();
 }
}
for(const subject of ['Primeira consulta','Valores e pagamento','Localização','Outro assunto']){
 await reset();await choose('Tenho dúvidas');await choose(subject);if(subject==='Localização')assert.equal(await actions.getByRole('link').count(),2);
 await choose('Continuar com a equipe');await choose('João Monlevade');await checkMessage('JM',subject);
}
for(const subject of ['Retorno','Consulta agendada','Falar com a equipe']){await reset();await choose('Já sou paciente');await choose(subject);await choose('Belo Horizonte');await checkMessage('BH',subject);}
await reset();await choose('Tenho dúvidas');await choose('Tratamentos');await dialog.locator('[data-support-human]').click();await choose('Belo Horizonte');await checkMessage('BH','Tratamentos');
for(const viewport of [{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000},{width:844,height:390}]){
 await page.setViewportSize(viewport);assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth));
 assert(await dialog.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1));
 const tabTarget=await actions.locator('[data-whatsapp]').getAttribute('href');assert(tabTarget);
}
await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%}'});assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth));
await page.emulateMedia({reducedMotion:'reduce'});await reset();await choose('Quero agendar');await choose('Belo Horizonte');assert(await actions.locator('[data-whatsapp]').isVisible());
await page.reload();await page.locator('.assistant-launcher').click();assert.equal(await page.locator('.chat-visitor').count(),0);await page.keyboard.press('Escape');
assert.equal(await page.locator('[data-unit-card="belo-horizonte"] [data-online-booking]').count(),0);
assert.equal(await page.locator('iframe[loading="lazy"]').count(),2);assert.equal(await page.locator('.footer-brand img').getAttribute('src'),'/assets/logo-transparent-600.webp');assert.equal(await page.locator('.agency-credit a').getAttribute('href'),'https://www.aguiadigital.com/');
const nojs=await browser.newContext({javaScriptEnabled:false});const np=await nojs.newPage();await np.goto(base+'/');assert(await np.locator('.assistant-launcher').isHidden());assert.equal(await np.locator('#unidades [data-online-booking]').count(),0);assert.equal(await np.locator('#unidades [data-whatsapp]').count(),2);await nojs.close();
assert.deepEqual(errors,[]);await writeFile('artifacts/support-verification.json',JSON.stringify({services:cases,otherDoubts:4,patientPaths:3,bookingUnits:2,history:'back/reset/reopen/reload',privacy:'no transcript persistence; no auto send; escaped note',responsive:'360-1440, landscape, 200% text, reduced motion, no JS',a11y,errors},null,2));
console.log(JSON.stringify({services:cases.length,errors,violations:a11y.map(a=>({stage:a.stage,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))}))},null,2));
await browser.close();assert.equal(a11y.flatMap(a=>a.violations).length,0);
