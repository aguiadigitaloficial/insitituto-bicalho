import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
const baseline=JSON.parse(await readFile(new URL('./fixtures/approved-copy.json',import.meta.url),'utf8'));
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const after=[];
try {
  const page=await browser.newPage({reducedMotion:'reduce'});
  for(const expected of baseline){
    await page.goto(base+expected.route,{waitUntil:'domcontentloaded'});
    for(const selector of ['.desktop-nav','.mobile-nav','.footer-top nav[aria-label="Links do rodapé"]'])assert.equal(await page.locator(`${selector} a[href="/conteudos/"]`).count(),1,`${expected.route}: exactly one Blog link in ${selector}`);
    const row=await page.evaluate(route=>({route,title:document.title,description:document.querySelector('meta[name="description"]').content,canonical:document.querySelector('link[rel="canonical"]').href,robots:document.querySelector('meta[name="robots"]').content,blocks:[...document.querySelectorAll('h1,h2,h3,p,a,button,address,summary,.eyebrow,.portrait-note')].filter(el=>!el.closest('[data-service-contact]')&&!(el.matches('a[href="/conteudos/"]')&&el.textContent.trim()==='Blog'&&el.closest('.site-header,.site-footer'))).map(el=>({tag:el.tagName,text:el.textContent.replace(/\s+/g,' ').trim()}))}),expected.route);
    const sha256=createHash('sha256').update(JSON.stringify(row).replace(/© \d{4}/g,'© {year}')).digest('hex');
    after.push({...row,sha256});
    assert.equal(row.blocks.length,expected.blocks,`${expected.route}: copy blocks changed`);
    assert.equal(sha256,expected.sha256,`${expected.route}: approved words or page metadata changed`);
  }
  await mkdir('artifacts/typography-review',{recursive:true});
  await writeFile('artifacts/typography-review/copy-after.json',JSON.stringify(after,null,2));
  console.log(`PASS: ${after.length} pages and ${after.reduce((n,r)=>n+r.blocks.length,0)} copy blocks preserved verbatim, including hidden panels and page metadata.`);
}finally{await browser.close();}
