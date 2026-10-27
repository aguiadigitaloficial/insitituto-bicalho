import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const page = await browser.newPage({viewport:{width:390,height:844}});
let tags = 0;
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
await page.route('**/*',async route => {
  const url = route.request().url();
  if(url.includes('googletagmanager.com')){tags++;return route.fulfill({contentType:'application/javascript',body:'/* analytics transport stub: no data leaves the browser */'});}
  if(url.startsWith(base+'/') && route.request().resourceType()==='document'){
    const response=await route.fetch();const body=(await response.text()).replace(/data-ga-id(?:="")?/, 'data-ga-id="G-TEST12345"');return route.fulfill({response,body});
  }
  return route.continue();
});
await page.goto(base+'/?utm_source=instagram&utm_medium=paid_social&utm_campaign=launch&email=private%40example.com');
assert.equal(tags,0);assert(await page.locator('.cookie-notice').isVisible());
await page.locator('[data-consent="denied"]').click();await page.reload();assert.equal(tags,0);assert(await page.locator('.cookie-notice').isHidden());
await page.locator('[data-cookie-settings]').click();await page.locator('[data-consent="granted"]').click();
await page.waitForFunction(()=>window.dataLayer?.length>=4);await page.waitForTimeout(200);assert.equal(tags,1);
await page.locator('#primary-booking').click();
const link=page.locator('#booking-dialog [data-whatsapp]').first();await link.evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));await link.click();
await page.keyboard.press('Escape');await page.locator('.assistant-launcher').click();
await page.getByRole('button',{name:'Tenho dúvidas',exact:true}).click();await page.getByRole('button',{name:'Valores e pagamento',exact:true}).click();await page.getByRole('button',{name:'Continuar com a equipe',exact:true}).click();await page.getByRole('button',{name:'Belo Horizonte',exact:true}).click();
await page.locator('#support-note').fill('PRIVATE_NOTE_123');const assistantLink=page.locator('#support-actions [data-whatsapp]');await assistantLink.evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));await assistantLink.click();
const events=await page.evaluate(()=>window.dataLayer.map(a=>Array.from(a)));
assert.equal(events.filter(e=>e[0]==='event'&&e[1]==='page_view').length,1);
assert(events.some(e=>e[1]==='whatsapp_click'&&e[2].unit==='joao-monlevade'&&e[2].placement==='hero'));
assert(!JSON.stringify(events).includes('private@example.com'));
assert(!JSON.stringify(events).includes('PRIVATE_NOTE_123'));assert(!JSON.stringify(events).includes('Valores e pagamento'));
assert(!events.some(e=>e[1]==='online_booking_click'));
assert(events.some(e=>e[1]==='whatsapp_click'&&e[2].unit==='belo-horizonte'&&e[2].placement==='assistant'));
assert(!events.some(e=>e[1]==='purchase'||e[1]==='generate_lead'));
await page.keyboard.press('Escape');
await page.goto(base+'/contato/?utm_source=instagram&email=private%40example.com');await page.waitForFunction(()=>window.dataLayer?.length>=4);
for(const id of ['joao-monlevade','belo-horizonte']){const contact=page.locator(`#unidades [data-whatsapp="${id}"]`);await contact.evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));await contact.click();}
const contactEvents=await page.evaluate(()=>window.dataLayer.map(a=>Array.from(a)));
for(const id of ['joao-monlevade','belo-horizonte'])assert(contactEvents.some(e=>e[1]==='whatsapp_click'&&e[2].unit===id&&e[2].placement==='contact-units'));
assert(!JSON.stringify(contactEvents).includes('private@example.com'));assert(!JSON.stringify(contactEvents).includes('PRIVATE_NOTE_123'));
await page.context().addCookies([{name:'_ga',value:'test',url:base+'/'}]);
await page.locator('[data-cookie-settings]').click();await page.locator('[data-consent="denied"]').click();await page.waitForLoadState('load');
assert.equal(tags,2);assert(!(await page.context().cookies()).some(c=>c.name.startsWith('_ga')));
console.log('PASS: consent gating, rejection, acceptance, page_view once, WhatsApp unit/placement, sanitized URL, revocation and cookie deletion; Google requests stubbed.');
await browser.close();
