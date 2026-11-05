import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:4321';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width:390, height:844 }, deviceScaleFactor:1 });
const page = await context.newPage();
const failures = [];
page.on('pageerror', error => failures.push(error.message));
const routes = ['/', '/tratamentos/', '/estetica/', '/ortodontia-e-cirurgia/', '/odontologia-de-precisao/', '/contato/', '/politica-de-privacidade/', '/termos-de-uso/', '/politica-de-cookies/'];
const titles = new Set();
const results = { routes: [], widths: [], interactions: [], accessibility: [] };
for (const route of routes) {
  const response = await page.goto(base + route);
  assert.equal(response.status(), 200, route);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  assert.equal(await page.locator('h1').count(),1,route);
  const title = await page.title(); assert(!titles.has(title)); titles.add(title);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
  assert.equal(await page.locator('a[href*="agenda.link"], [data-online-booking]').count(),0,route);
  assert(!/agendar online|agenda online|agenda\.link/i.test(await page.locator('body').innerText()),route);
  const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i=>i.complete && !i.naturalWidth).map(i=>i.src)); assert.deepEqual(broken, [], route);
  assert(await page.locator('h1').isVisible());
  for(const selector of ['.desktop-nav','.mobile-nav','.footer-top nav[aria-label="Links do rodapé"]'])assert.equal(await page.locator(`${selector} a[href="/contato/"]`).count(),1,route);
  if(route==='/contato/'){
    await page.waitForFunction(()=>['ready','reduced','unavailable'].includes(document.body.dataset.motion)&&+getComputedStyle(document.querySelector('.unit')).opacity>=.99);
    assert.equal(title,'Contato e unidades | Instituto Bicalho');
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),title);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://institutobicalho.com/contato/');
    assert.equal(await page.locator('.desktop-nav [aria-current="page"]').textContent(),'Contato');
    assert.equal(await page.locator('#unidades [data-position="contact-units"]').count(),2);
    assert(await page.locator('.unit').evaluateAll(cards=>cards.every(card=>{
      const wa=card.querySelector('[data-whatsapp]'),phone=card.querySelector('.unit-phone'),map=card.querySelector('iframe');
      return !!(wa.compareDocumentPosition(phone)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(phone.compareDocumentPosition(map)&Node.DOCUMENT_POSITION_FOLLOWING);
    })),'Contact channels must precede maps in DOM');
  }
  const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  results.accessibility.push({ route, violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})) });
  results.routes.push({route,status:response.status(),title});
}
for (const width of [360,390,430,768,1024,1440]) {
  await page.setViewportSize({width,height:width>900?1000:844});
  for (const route of routes.slice(0,6)) {
    await page.goto(base+route); await page.evaluate(()=>document.fonts.ready);
    const size = await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:innerWidth}));
    assert(size.scroll<=size.client, `${route} overflows at ${width}: ${JSON.stringify(size)}`);
    results.widths.push({width,route,overflow:false});
  }
}
await page.setViewportSize({width:390,height:844}); await page.goto(base);
await page.locator('.menu-toggle').click(); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
await page.keyboard.press('Escape'); assert(await page.locator('.mobile-nav').isHidden());
await page.locator('#primary-booking').click(); assert(await page.locator('#booking-dialog').isVisible());
assert.equal(await page.locator('#booking-dialog [data-whatsapp]').count(),2);
await page.keyboard.press('Escape'); assert(await page.locator('#booking-dialog').isHidden());
assert(await page.locator('#primary-booking').evaluate(el=>el===document.activeElement));
await page.locator('.institution-copy').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'})); await page.waitForTimeout(250); assert(await page.locator('.mobile-cta').isVisible());
await page.locator('#unidades').scrollIntoViewIfNeeded(); await page.waitForTimeout(250); assert(await page.locator('.mobile-cta').isHidden());
await page.locator('.faq-list summary').first().click(); assert(await page.locator('.faq-list details').first().getAttribute('open')!==null);
await page.locator('[data-cookie-settings]').click(); assert(await page.locator('.cookie-notice').isVisible());
await page.locator('[data-consent="denied"]').click(); assert(await page.locator('.cookie-notice').isHidden());
await page.goto(base+'/?utm_source=instagram&utm_medium=paid_social&utm_campaign=instituto');
const internal = await page.locator('.area-card').first().getAttribute('href'); assert(internal.includes('utm_source=instagram'));
await page.goto(base+internal); await page.locator('#primary-booking').click();
const whatsappHref = await page.locator('#booking-dialog [data-whatsapp]').first().getAttribute('href'); assert(!whatsappHref.includes('utm_')); assert(whatsappHref.startsWith('https://wa.me/5531992957448'));
results.interactions.push('Menu + Escape','Booking dialog + focus restoration','Sticky CTA visibility','FAQ','Consent refusal','Campaign preserved across pages, absent from WhatsApp');
await page.setViewportSize({width:844,height:390}); await page.goto(base); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.setViewportSize({width:390,height:844}); await page.goto(base);
await page.addStyleTag({content:'html {font-size:200%}'}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.emulateMedia({reducedMotion:'reduce'}); await page.goto(base); assert.equal(await page.locator('.reveal-pending').count(),0);
const unknown = await page.goto(base+'/pagina-inexistente/'); assert.equal(unknown.status(),404);
const redirects=JSON.parse(await readFile('redirects.json','utf8'));
for(const [from,to] of Object.entries(redirects)){const r=await fetch(base+from,{redirect:'manual'});assert.equal(r.status,301);assert.equal(r.headers.get('location'),to);}
const sitemap = await (await fetch(base+'/sitemap.xml')).text(); for(const route of routes) assert(sitemap.includes('https://institutobicalho.com'+route)); assert(!sitemap.includes('404'));
const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}); const np=await nojs.newPage(); await np.goto(base); assert(await np.locator('h1').isVisible()); assert(await np.locator('.noscript-nav').isVisible());
assert.equal(await np.locator('.team-panel').getAttribute('open'),null);
await np.locator('.team-panel>summary').click();assert(await np.locator('.team-person').last().isVisible());assert.equal(await np.locator('.team-person').count(),23);
await np.locator('.team-panel>summary').press('Enter');assert.equal(await np.locator('.team-panel').getAttribute('open'),null);
for(const fragment of ['equipe','equipe-completa']){await np.goto(`${base}/#${fragment}`);await np.waitForFunction(()=>{const r=document.querySelector('.team-panel>summary').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});}
await np.locator('.noscript-nav a[href="/contato/"]').click();assert.equal(new URL(np.url()).pathname,'/contato/');assert.equal(await np.locator('.noscript-nav [aria-current="page"]').textContent(),'Contato');assert.equal(await np.locator('#unidades [data-whatsapp]').count(),2);
await nojs.close();
await page.emulateMedia({reducedMotion:'reduce'});
async function preparePhotos(){await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode().catch(()=>{});})));await page.evaluate(()=>document.fonts.ready);}
await page.setViewportSize({width:390,height:844}); await page.goto(base); await preparePhotos(); await page.screenshot({path:'artifacts/home-mobile.png',fullPage:true}); await page.screenshot({path:'artifacts/hero-mobile.png'});
await page.locator('.precision').screenshot({path:'artifacts/precision-mobile.png'});await page.locator('.areas').screenshot({path:'artifacts/areas-mobile.png'});
await page.setViewportSize({width:1440,height:1000}); await page.goto(base); await preparePhotos(); await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true}); await page.screenshot({path:'artifacts/hero-desktop.png'});
await writeFile('artifacts/verification.json',JSON.stringify({...results,consoleErrors:failures},null,2));
await browser.close();
assert.deepEqual(failures,[]);
const violations=results.accessibility.flatMap(r=>r.violations.map(v=>({route:r.route,...v})));
console.log(JSON.stringify({routes:results.routes.length,responsiveChecks:results.widths.length,interactions:results.interactions,violations},null,2));
assert.equal(violations.length,0,'Accessibility violations');
