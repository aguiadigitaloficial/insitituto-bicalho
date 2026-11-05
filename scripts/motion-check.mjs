import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_URL||'http://127.0.0.1:4321');
await page.waitForFunction(()=>document.body.dataset.motion==='ready');
await page.waitForTimeout(1200);
assert.equal(await page.locator('.motion-line').count(),0,'Heading motion must preserve native line balancing');
assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).opacity),'1');
assert.equal((await page.locator('h1').textContent()).replace(/\s+/g,' ').trim(),'Clínica odontológica em João Monlevade e Belo Horizonte.');
assert.equal(await page.locator('#instituto .team-panel').count(),1);
assert.equal(await page.locator('.team-panel').getAttribute('open'),null);
assert.equal(await page.locator('.team-person').count(),23);
assert.equal(await page.locator('.institution-copy a').count(),0);
assert.equal(await page.locator('.team-editorial, #team-heading').count(),0);
assert.equal(await page.locator('#equipe #equipe-completa').count(),1);
const sections=await page.locator('main>section').count();
assert.equal(sections,6,'Home should no longer contain a separate team scene');
for(let i=0;i<sections;i++){
 await page.locator('main>section').nth(i).scrollIntoViewIfNeeded();
 await page.waitForTimeout(60);
}
await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
await page.waitForTimeout(1100);
for(const selector of ['.institution-copy>p','.area-card-copy','.unit']){
 assert(await page.locator(selector).evaluateAll(els=>els.every(el=>+getComputedStyle(el).opacity>.99)),`${selector} stayed hidden`);
}
await page.locator('.team-panel>summary').click();await page.waitForTimeout(350);
assert.equal(await page.locator('.team-person').count(),23);
assert.equal(await page.locator('.team-panel').getAttribute('open'),'');
await page.locator('.team-panel>summary').click();await page.waitForTimeout(350);
assert.equal(await page.locator('.team-panel').getAttribute('open'),null);
for(const selector of ['.faq-list details:first-child','.team-panel']){
 await page.locator(`${selector}>summary`).click(); await page.waitForTimeout(300);
 assert.equal(await page.locator(selector).getAttribute('open'),'');
 await page.locator(`${selector}>summary`).press('Enter'); await page.waitForTimeout(300);
 assert.equal(await page.locator(selector).getAttribute('open'),null);
 assert.equal(await page.locator(selector).evaluate(el=>el.style.height),'');
}
for(const viewport of [{width:360,height:800},{width:390,height:844},{width:430,height:900},{width:768,height:1000},{width:1024,height:1000},{width:1440,height:1000},{width:844,height:390}]){
 await page.setViewportSize(viewport);await page.waitForTimeout(550);
 assert.equal(await page.locator('body').getAttribute('data-motion'),'ready');
 assert.equal(await page.locator('.motion-line .motion-line').count(),0);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.team-panel>summary').click();await page.waitForTimeout(300);
 assert(await page.locator('.team-person').last().isVisible());
 await page.locator('.team-panel>summary').press('Enter');await page.waitForTimeout(300);
 const layout=await page.locator('.team-panel').evaluate(panel=>{
  const box=panel.getBoundingClientRect(),summary=panel.querySelector('summary').getBoundingClientRect();
  const container=panel.closest('.container').getBoundingClientRect(),editorial=panel.closest('.container').querySelector('.institution-layout').getBoundingClientRect();
  return {left:Math.abs(box.left-container.left),right:Math.abs(box.right-container.right),extraHeight:box.height-summary.height,gap:box.top-editorial.bottom,height:panel.style.height};
 });
 assert(layout.left<1&&layout.right<1,`Team panel must span the container at ${viewport.width}`);
 assert(layout.extraHeight<=3&&layout.height==='',`Closing leaves unused height at ${viewport.width}`);
 assert(layout.gap>=30&&layout.gap<=62,`Panel must sit below the portraits at ${viewport.width}`);
}
await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
await page.addStyleTag({content:'html{font-size:200%}'});await page.waitForTimeout(800);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);
assert.equal(await page.locator('body').getAttribute('data-motion'),'reduced');
assert.equal(await page.locator('.motion-line').count(),0);
assert(await page.locator('main [style]').evaluateAll(els=>els.every(el=>+getComputedStyle(el).opacity>.99)));
await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(300);
assert.equal(await page.locator('body').getAttribute('data-motion'),'ready');
assert.deepEqual(errors,[]);
await writeFile('artifacts/motion-v2.json',JSON.stringify({motion:'approved entrance composition and interactive transitions',headings:'native balanced text; whole-heading entrance',scroll:'fast scroll and return, no hidden content',accordions:'team 23, FAQ, pointer, Enter and close',responsive:'desktop/mobile/orientation/200% text/reduced motion live rebuild',errors},null,2));
console.log('Motion tests passed');await browser.close();
