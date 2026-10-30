import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { inspectTextLayout } from './text-layout.mjs';
const base = process.env.TEST_URL || 'http://127.0.0.1:4321';
const routes = ['/', '/tratamentos/', '/estetica/', '/ortodontia-e-cirurgia/', '/odontologia-de-precisao/', '/contato/', '/politica-de-privacidade/', '/termos-de-uso/', '/politica-de-cookies/', '/404.html'];
const widths = process.env.TYPE_WIDTHS ? process.env.TYPE_WIDTHS.split(',').map(Number) : [320,375,390,393,414,430,600,768,820,1024,1199,1200,1366,1440,1920,2560];
const engines = process.env.TYPE_ENGINES?.split(',') || ['chromium','webkit'];
const checks = [], errors = [], externalMapErrors = [];
await mkdir('artifacts/typography-review', { recursive: true });
for (const name of engines) {
  const browser = await (name === 'webkit' ? webkit : chromium).launch(name === 'webkit' ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage({ reducedMotion:'reduce', deviceScaleFactor:3 });
    let confirmProbe;
    // Attribute errors to their real frame. Google Maps' internal scripts are outside
    // this typography audit; their errors remain visible in the report, not hidden.
    await page.exposeBinding('__bicalhoLayoutError', ({frame}, detail) => {
      const source=new URL(frame.url());const row={name,route:page.url(),source:source.origin+source.pathname,error:detail.message};
      if(frame.parentFrame()&&source.hostname==='www.google.com'&&source.pathname.startsWith('/maps/embed'))externalMapErrors.push(row);else errors.push(row);
      if(detail.message.includes('Bicalho typography audit probe'))confirmProbe?.();
    });
    await page.addInitScript(()=>{
      window.addEventListener('error',event=>{if(event instanceof ErrorEvent)void window.__bicalhoLayoutError({message:event.message});});
      window.addEventListener('unhandledrejection',event=>{void window.__bicalhoLayoutError({message:String(event.reason?.message||event.reason)});});
    });
    // Prove that the observer catches first-party runtime failures before trusting a clean report.
    await page.goto(base+'/404.html',{waitUntil:'domcontentloaded'});
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Browser error observer did not report the probe')),5000);confirmProbe=()=>{clearTimeout(timeout);resolve();};void page.evaluate(()=>{setTimeout(()=>{throw new Error('Bicalho typography audit probe');},0);});});
    const probe=errors.findIndex(e=>e.error.includes('Bicalho typography audit probe'));assert(probe>=0);errors.splice(probe,1);confirmProbe=undefined;
    for (const scale of [1,2]) for (const width of scale === 1 ? widths : widths.filter(w => [320,393,768,1024,1366,2560].includes(w))) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : width < 600 ? 844 : width < 1024 ? 1024 : 900 });
      for (const route of routes) {
        await page.goto(base+route, { waitUntil:'domcontentloaded' });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => { document.querySelectorAll('details').forEach(el => { el.open=true; }); });
        if (scale === 2) await page.addStyleTag({ content:'html{font-size:200%}' });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const result = await page.evaluate(inspectTextLayout, { scale });
        checks.push({ browser:name, route, width, scale, ...result });
      }
    }
    // Normal motion and the fallback without text-wrap:pretty use the same line groups.
    for (const width of [393,820,1366]) {
      await page.setViewportSize({ width,height:900 });
      await page.emulateMedia({ reducedMotion:'no-preference' });
      for (const route of routes.slice(0,6)) {
        await page.goto(base+route); await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => ['ready','reduced','unavailable'].includes(document.body.dataset.motion));
        await page.addStyleTag({ content:'p,address{text-wrap:wrap}' });
        const result = await page.evaluate(inspectTextLayout, { scale:1 });
        checks.push({ browser:name, route, width, scale:1, motion:'normal', pretty:false, ...result });
      }
    }
    // Inspect the actual opened surfaces as well as the page underneath them.
    for (const width of [320,393,768,1366]) for (const scale of [1,2]) {
      await page.setViewportSize({width,height:width<600?844:900});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.goto(base); await page.evaluate(() => document.fonts.ready);
      if(scale===2)await page.addStyleTag({content:'html{font-size:200%}'});
      for(const panel of ['booking','support','cookies',...(width<1200?['menu']:[])]) {
        if(panel==='booking')await page.locator('#primary-booking').click();
        if(panel==='support') {
          // The launcher correctly hides over links; open it from a paragraph-only area.
          await page.locator('.institution-copy').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
          await page.locator('.assistant-launcher').click();
          await page.getByRole('button',{name:'Tenho dúvidas',exact:true}).click();
        }
        if(panel==='cookies')await page.locator('[data-cookie-settings]').click();
        if(panel==='menu')await page.locator('.menu-toggle').click();
        const result=await page.evaluate(inspectTextLayout,{scale});
        checks.push({browser:name,route:'/',width,scale,panel,...result});
        if(panel==='cookies')await page.locator('[data-consent="denied"]').click();
        else {
          await page.keyboard.press('Escape');
          if(panel==='menu')await page.waitForFunction(()=>document.querySelector('.mobile-nav').hidden);
          else await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&!document.body.classList.contains('modal-open'));
        }
      }
    }
  } finally { await browser.close(); }
}
const failures = checks.filter(check => check.overflow > 0 || check.clipped.length || check.failures.length);
await writeFile('artifacts/typography-review/lines.json', JSON.stringify({ checks,failures,errors,externalMapErrors },null,2));
console.log(JSON.stringify({ checks:checks.length, measured:checks.reduce((n,c)=>n+c.elements.length,0), failures:failures.length, examples:failures.slice(0,8).map(c=>({browser:c.browser,width:c.width,route:c.route,scale:c.scale,overflow:c.overflow,clipped:c.clipped,failures:c.failures})) },null,2));
assert.deepEqual(errors,[]);
assert.equal(failures.length,0,'Rendered line audit failed; see artifacts/typography-review/lines.json');
