import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const routes=['/','/tratamentos/','/estetica/','/ortodontia-e-cirurgia/','/odontologia-de-precisao/'];
for(const route of routes){
 await page.goto(base+route);await page.waitForFunction(()=>document.body.dataset.motion==='ready');
 assert(await page.locator('[data-booking-cta]').evaluateAll(els=>els.every(el=>el.querySelector('.brand-button-symbol img')?.getAttribute('src')==='/assets/brand-symbol.webp')));
 await page.locator('#primary-booking').click();assert(await page.locator('#booking-dialog').isVisible());await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement===document.querySelector('#primary-booking'));
}
await page.goto(base);await page.waitForFunction(()=>document.body.dataset.motion==='ready');
await page.locator('.menu-toggle').click();await page.locator('.mobile-nav [data-booking-cta]').click();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement===document.querySelector('.menu-toggle'));
await page.locator('.institution-copy').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(800);const bar=page.locator('.mobile-cta [data-booking-cta]');assert(await bar.isVisible());await bar.click();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement===document.querySelector('.mobile-cta [data-booking-cta]'));
const dimensions=[];
for(const width of [360,390,430,768,1024,1440]){
 await page.setViewportSize({width,height:width>=1000?1000:844});await page.locator('.partner-photos').scrollIntoViewIfNeeded();await page.locator('.portrait-note').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(1200);
 const box=await page.locator('.partner-photos').evaluate(group=>{const photo=group.querySelector('.photo').getBoundingClientRect(),note=group.querySelector('.portrait-note').getBoundingClientRect();return{count:group.querySelectorAll('.photo').length,left:Math.abs(photo.left-note.left),right:Math.abs(photo.right-note.right),gap:note.top-photo.bottom,width:photo.width,ratio:photo.width/photo.height,radius:getComputedStyle(group).borderBottomRightRadius};});
 assert.equal(box.count,1);assert(box.left<1&&box.right<1&&Math.abs(box.gap)<1&&box.width<=(width>=1024?560:640),JSON.stringify({width,box}));assert(Math.abs(box.ratio-(width<600?1:4/3))<.002);assert.equal(box.radius,'28px');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));dimensions.push({width,...box});
 for(const selector of ['.hero-image-base','.portrait-note']){
  await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();scrollTo({top:r.top+scrollY-innerHeight+50,behavior:'instant'});});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert(await page.locator(selector).evaluate(caption=>{const c=caption.getBoundingClientRect();return [...document.querySelectorAll('.assistant-launcher,.mobile-cta')].every(el=>{if(el.hidden||getComputedStyle(el).visibility==='hidden')return true;const r=el.getBoundingClientRect();return r.right<=c.left||r.left>=c.right||r.bottom<=c.top||r.top>=c.bottom;});}),`${selector}: floating controls cover its text at ${width}px`);
 }
 if(width===390||width===1440){await page.locator('.partner-photos').screenshot({path:`artifacts/portraits-aligned-${width}.png`});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(250);await page.screenshot({path:`artifacts/cta-unified-${width}.png`});}
}
await page.locator('.header-booking').click();assert(await page.locator('#booking-dialog').isVisible());await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement===document.querySelector('.header-booking'));
// A cancelled press must return to rest without navigating or leaving a stuck transform.
await page.locator('.header-booking').dispatchEvent('pointerdown');await page.waitForTimeout(160);assert.notEqual(await page.locator('.header-booking').evaluate(el=>getComputedStyle(el).transform),'none');await page.locator('.header-booking').dispatchEvent('pointercancel');await page.waitForTimeout(350);assert.equal(await page.locator('.header-booking').evaluate(el=>el.style.transform),'');
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);await page.locator('.header-booking').press('Enter');assert(await page.locator('#booking-dialog').isVisible());await page.keyboard.press('Escape');assert(await page.locator('.header-booking').evaluate(el=>{const t=getComputedStyle(el).transform;return t==='none'||new DOMMatrix(t).isIdentity;}));
assert.deepEqual(errors,[]);await writeFile('artifacts/cta-verification.json',JSON.stringify({routes,dimensions,flows:['hero','header','menu','mobile bar','Escape and focus restoration','press/cancel','reduced motion'],errors},null,2));await browser.close();console.log('PASS: all evaluation CTAs, all 5 pages, focus return, press/reduced motion, photo alignment at 6 widths.');
