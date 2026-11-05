/** Precision flow: preserved copy/photo, reflow and the actual once-only composed entrance. */
import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = (process.env.TEST_URL || 'http://127.0.0.1:4328').replace(/\/$/, '');
const output = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/precision-flow');
const widths = [320, 375, 390, 393, 414, 600, 768, 834, 1024, 1199, 1200, 1366, 1920, 2560];
const steps = [
  { number: '01', title: 'Escaneamento', summary: 'Captura intraoral digital.', detail: 'Substitui a moldagem tradicional e registra a arcada em poucos minutos.' },
  { number: '02', title: 'Planejamento', summary: 'Simulação do tratamento.', detail: 'A equipe define etapas e antecipa o resultado antes de iniciar o procedimento.' },
  { number: '03', title: 'Execução', summary: 'Procedimento guiado pelo plano.', detail: 'O tratamento segue o planejamento definido com o paciente.' },
];
const expectedText = 'Odontologia de Precisão Planejamento digital antes de qualquer procedimento. O escaneamento intraoral substitui a moldagem tradicional e alimenta o planejamento digital, do dente único à reabilitação completa. Imagem digital. Base para o plano de tratamento. ' + steps.map(step => Object.values(step).join(' ')).join(' ') + ' Conheça o fluxo digital';
const report = { base, startedAt: new Date().toISOString(), baseline: null, layouts: [], motion: [], density: [], noJavaScript: [], screenshots: [], screenshotNote: 'Only locator screenshots temporarily hide fixed header, scheduling bar and assistant; behavior tests and videos keep the actual controls.', videos: [], errors: [] };
let baseline, baselineViewports = [];
try {
  const filename = path.resolve(process.env.PRECISION_BASELINE || 'artifacts/precision-flow/before.json');
  const saved = JSON.parse(await readFile(filename, 'utf8'));
  baselineViewports = saved.viewports || [];
  baseline = saved.viewports?.[0] || saved.precision || saved;
  report.baseline = { filename, capturedAt: saved.capturedAt || null };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  report.baseline = { source: 'independent existing section copy and three stage texts' };
}
await mkdir(output, { recursive: true });

function monitor(page, label) {
  page.on('pageerror', error => report.errors.push({ label, message: error.message, stack: error.stack }));
}

async function visit(page, motion = 'reduced') {
  const response = await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, 'Home response');
  await page.evaluate(() => document.fonts.ready);
  if (motion) await expect(page.locator('body')).toHaveAttribute('data-motion', motion);
  const reject = page.getByRole('button', { name: 'Recusar', exact: true });
  if (await reject.isVisible()) await reject.click();
  await expect(page.locator('.precision')).toHaveCount(1);
  await expect(page.locator('.precision > .container > ol.digital-flow')).toHaveCount(1);
}

async function copyAndPhoto(page) {
  const actual = await page.locator('.precision').evaluate(section => ({
    viewport: innerWidth,
    text: section.innerText.replace(/\s+/g, ' ').trim(),
    headings: [...section.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => ({ level: Number(heading.tagName.slice(1)), text: heading.textContent.replace(/\s+/g, ' ').trim() })),
    links: [...section.querySelectorAll('a')].map(link => ({ text: link.textContent.replace(/\s+/g, ' ').trim(), href: link.getAttribute('href') })),
    steps: [...section.querySelectorAll('.digital-flow > li')].map(step => ({ number: step.querySelector('.flow-number').textContent.trim(), title: step.querySelector('h3').textContent.replace(/\s+/g, ' ').trim(), summary: step.querySelector('p').textContent.replace(/\s+/g, ' ').trim(), detail: step.querySelector('small').textContent.replace(/\s+/g, ' ').trim() })),
    photo: [...section.querySelectorAll('.precision-photo')].map(photo => ({
      src: photo.querySelector('img').getAttribute('src'), srcset: photo.querySelector('img').getAttribute('srcset'), alt: photo.querySelector('img').getAttribute('alt'),
      width: photo.querySelector('img').getAttribute('width'), height: photo.querySelector('img').getAttribute('height'), objectPosition: getComputedStyle(photo.querySelector('img')).objectPosition,
      schema: [...photo.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent)),
    })),
  }));
  assert.equal(actual.text, expectedText, 'Every existing word remains in the same editorial order');
  assert.deepEqual(actual.steps, steps);
  assert.deepEqual(actual.headings, [{ level: 2, text: 'Planejamento digital antes de qualquer procedimento.' }, ...steps.map(step => ({ level: 3, text: step.title }))]);
  assert.deepEqual(actual.links, [{ text: 'Conheça o fluxo digital', href: '/odontologia-de-precisao/' }]);
  assert.equal(actual.photo.length, 1);
  assert.equal(actual.photo[0].src, '/assets/official-care-room-1200.webp');
  assert.equal(actual.photo[0].objectPosition, actual.viewport >= 1000 ? '50% 48%' : '67% 45%');
  if (baseline?.text) assert.equal(actual.text, baseline.text, 'Hosted before/after section copy');
  if (baseline?.headings) assert.deepEqual(actual.headings, baseline.headings, 'Heading hierarchy unchanged');
  if (baseline?.links) assert.deepEqual(actual.links, baseline.links.map(({ text, href }) => ({ text, href })), 'Link labels and destinations unchanged');
  const oldViewport = baselineViewports.find(viewport => viewport.width === actual.viewport) || baseline;
  const oldPhoto = oldViewport?.photos?.[0] || oldViewport?.photo;
  if (oldPhoto) for (const field of ['src', 'srcset', 'alt', 'width', 'height', 'objectPosition', 'schema']) {
    if (field === 'objectPosition' && oldViewport?.width && oldViewport.width !== actual.viewport) continue;
    if (field in oldPhoto) assert.deepEqual(actual.photo[0][field], oldPhoto[field], `Precision photograph ${field} unchanged`);
  }
  await expect(page.locator('.precision .flow-connection, .digital-flow .is-current')).toHaveCount(0);
  return actual;
}

async function geometry(page, engine, width, scale) {
  const actual = await page.locator('.precision').evaluate(section => {
    const flow = section.querySelector('.digital-flow'), flowStyle = getComputedStyle(flow), flowBox = flow.getBoundingClientRect().toJSON();
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const items = [...flow.children].map(item => {
      const number = item.querySelector('.flow-number'), numberStyle = getComputedStyle(number), body = item.querySelector(':scope > div');
      const brokenWords = [];
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) for (const word of node.textContent.matchAll(/\S+/g)) {
        const range = document.createRange(); range.setStart(node, word.index); range.setEnd(node, word.index + word[0].length);
        const rows = new Set([...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => Math.round(rect.top)));
        if (rows.size > 1) brokenWords.push(word[0]);
      }
      const before = getComputedStyle(item, '::before'), after = getComputedStyle(item, '::after');
      return {
        box: item.getBoundingClientRect().toJSON(), number: number.getBoundingClientRect().toJSON(), body: body.getBoundingClientRect().toJSON(),
        numberBackground: numberStyle.backgroundColor, numberColor: numberStyle.color,
        numberBorder: numberStyle.borderTopWidth, numberRadius: numberStyle.borderRadius,
        children: [...body.children].map(element => ({ tag: element.tagName, box: element.getBoundingClientRect().toJSON(), client: element.clientWidth, scroll: element.scrollWidth, fontSize: parseFloat(getComputedStyle(element).fontSize) })),
        brokenWords, decorativePseudo: [before, after].some(style => style.display !== 'none' && !['none', 'normal', ''].includes(style.content)),
      };
    });
    const photo = section.querySelector('.precision-photo'), img = photo.querySelector('img'), photoBox = photo.getBoundingClientRect().toJSON();
    return {
      rootSize, flowBox, columns: flowStyle.gridTemplateColumns.split(' ').length, gap: parseFloat(flowStyle.columnGap),
      flowScrollWidth: flow.scrollWidth, flowClientWidth: flow.clientWidth, section: section.getBoundingClientRect().toJSON(),
      documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, viewport: innerWidth,
      items, photo: { box: photoBox, image: img.getBoundingClientRect().toJSON(), objectFit: getComputedStyle(img).objectFit, position: getComputedStyle(img).objectPosition },
    };
  });
  const label = `${engine}/${width}/${scale * 100}%`, tolerance = 1.1;
  assert(actual.documentWidth <= actual.viewport + tolerance && actual.bodyWidth <= actual.viewport + tolerance, `${label}: no page horizontal overflow`);
  assert(actual.flowScrollWidth <= actual.flowClientWidth + tolerance, `${label}: flow content fits`);
  const fittedColumns = Math.min(3, Math.max(1, Math.floor((actual.flowBox.width + actual.gap + .1) / (20 * actual.rootSize + actual.gap))));
  assert.equal(actual.columns, width < 1200 ? 1 : fittedColumns, `${label}: readable flow columns`);
  if (scale === 1) assert.equal(actual.columns, width < 1200 ? 1 : 3, `${label}: approved normal layout`);
  for (const [index, item] of actual.items.entries()) {
    assert(item.box.left >= actual.flowBox.left - tolerance && item.box.right <= actual.flowBox.right + tolerance && item.box.top >= actual.flowBox.top - tolerance && item.box.bottom <= actual.flowBox.bottom + tolerance, `${label}/${index}: stage remains contained`);
    assert(Math.abs(item.number.width - 2.75 * actual.rootSize) < tolerance && Math.abs(item.number.height - 2.75 * actual.rootSize) < tolerance, `${label}/${index}: number is a stable 2.75rem circle`);
    assert.equal(item.numberBackground, 'rgb(145, 220, 224)', `${label}/${index}: static filled number`);
    assert.equal(item.numberColor, 'rgb(16, 47, 67)');
    assert.equal(item.numberBorder, '1px');
    assert.equal(item.numberRadius, '50%');
    assert(!item.decorativePseudo, `${label}/${index}: no residual generated connectors`);
    assert.deepEqual(item.brokenWords, [], `${label}/${index}: no words split across lines`);
    for (const box of [item.number, item.body, ...item.children.map(child => child.box)]) {
      assert(box.left >= item.box.left - tolerance && box.right <= item.box.right + tolerance && box.top >= item.box.top - tolerance && box.bottom <= item.box.bottom + tolerance, `${label}/${index}: text and number fit their stage`);
    }
    const sideBySide = item.body.left >= item.number.right - tolerance;
    if (sideBySide) assert(Math.abs(item.body.top - item.number.top) < tolerance, `${label}/${index}: aligned identity row`);
    else assert(item.body.top >= item.number.bottom - tolerance, `${label}/${index}: enlarged text reflows below its number`);
    for (let childIndex = 0; childIndex < item.children.length; childIndex++) {
      const child = item.children[childIndex];
      assert(child.scroll <= child.client + tolerance, `${label}/${index}/${child.tag}: no clipped text`);
      assert(child.fontSize >= (child.tag === 'SMALL' ? 14 : 16) * scale - .1, `${label}/${index}/${child.tag}: text remains readable`);
      if (childIndex) assert(child.box.top >= item.children[childIndex - 1].box.bottom - tolerance, `${label}/${index}: content does not overlap`);
    }
    if (index) {
      const previous = actual.items[index - 1];
      assert(item.box.top >= previous.box.bottom - tolerance || item.box.left >= previous.box.right - tolerance, `${label}: neighboring stages do not overlap`);
    }
  }
  assert(actual.photo.box.left >= actual.section.left - tolerance && actual.photo.box.right <= actual.section.right + tolerance, `${label}: photograph stays inside the section`);
  assert(Math.abs(actual.photo.image.width - actual.photo.box.width) < tolerance && Math.abs(actual.photo.image.height - actual.photo.box.height) < tolerance, `${label}: photograph fills its existing frame`);
  assert.equal(actual.photo.objectFit, 'cover');
  assert.equal(actual.photo.position, width >= 1000 ? '50% 48%' : '67% 45%');
  const oldDimensions = baselineViewports.find(viewport => viewport.width === width)?.photos?.[0]?.rendered;
  if (scale === 1 && oldDimensions) {
    assert(Math.abs(actual.photo.box.width - oldDimensions.width) < tolerance && Math.abs(actual.photo.box.height - oldDimensions.height) < tolerance, `${label}: photograph keeps the original frame dimensions`);
  }
  report.layouts.push({ engine, width, height: await page.evaluate(() => innerHeight), scale, columns: actual.columns, flowHeight: actual.flowBox.height, contained: true, wordsIntact: true, photoPreserved: true });
}

async function capture(page, engine, width) {
  await page.locator('.precision-photo img').scrollIntoViewIfNeeded();
  await page.locator('.precision-photo img').evaluate(image => image.decode());
  for (const [name, selector] of [['section', '.precision'], ['flow', '.digital-flow']]) {
    const filename = path.join(output, `${engine}-${width}-${name}.png`);
    await page.locator(selector).screenshot({ path: filename, animations: 'disabled', style: '.site-header,.mobile-cta,.assistant-launcher,.skip-link{visibility:hidden!important}' });
    report.screenshots.push(filename);
  }
}

async function resting(page, label) {
  const state = await page.locator('.digital-flow').evaluate(flow => ({
    opacity: Number(getComputedStyle(flow).opacity), y: new DOMMatrix(getComputedStyle(flow).transform).m42,
    classes: [...flow.querySelectorAll('.is-current')].length,
    children: [...flow.querySelectorAll('li,.flow-number,li>div,h3,p,small')].map(element => ({ opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform, visibility: getComputedStyle(element).visibility })),
    backgrounds: [...flow.querySelectorAll('.flow-number')].map(element => getComputedStyle(element).backgroundColor),
  }));
  assert(state.opacity > .999 && Math.abs(state.y) < .1, `${label}: flow stays fully visible at rest (opacity=${state.opacity}, y=${state.y})`);
  assert.equal(state.classes, 0);
  assert(state.children.every(child => child.opacity === 1 && child.transform === 'none' && child.visibility === 'visible'), `${label}: children have no independent animation`);
  assert(state.backgrounds.every(background => background === 'rgb(145, 220, 224)'), `${label}: number appearance does not depend on scroll`);
  return state;
}

async function motionCheck(browser, engine, width) {
  const height = width === 1366 ? 768 : 844;
  const record = engine === 'chromium' && width === 1366 && process.env.RECORD_VIDEO !== '0';
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference', ...(record ? { recordVideo: { dir: path.join(output, 'video'), size: { width, height } } } : {}) });
  const page = await context.newPage(); monitor(page, `${engine}/${width}/motion`);
  const video = page.video();
  try {
    await visit(page, 'ready');
    const before = await page.locator('.digital-flow').evaluate(flow => {
      const style = getComputedStyle(flow), y = new DOMMatrix(style.transform).m42;
      return { top: flow.getBoundingClientRect().top + scrollY - y, opacity: Number(style.opacity), y };
    });
    assert.equal(before.opacity, 0, `${engine}/${width}: flow awaits its entrance below the fold`);
    assert(Math.abs(before.y - 12) < .1, `${engine}/${width}: initial translation is 12px`);
    const startScroll = before.top - height * .85 - 60;
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), startScroll);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.digital-flow').evaluate(flow => Number(getComputedStyle(flow).opacity)), 0, `${engine}/${width}: no entrance before top 85%`);
    const frames = await page.evaluate(async ({ startScroll }) => {
      const flow = document.querySelector('.digital-flow');
      const samples = []; const start = performance.now();
      while (performance.now() - start < 2300) {
        const elapsed = performance.now() - start;
        scrollTo({ top: startScroll + Math.min(elapsed / 1400, 1) * 180, behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(resolve));
        const style = getComputedStyle(flow), box = flow.getBoundingClientRect();
        samples.push({ elapsed: performance.now() - start, top: box.top, y: new DOMMatrix(style.transform).m42, opacity: Number(style.opacity),
          children: [...flow.querySelectorAll('li,.flow-number,li>div,h3,p,small')].map(element => { const child = element.getBoundingClientRect(), ownStyle = getComputedStyle(element); return { left: child.left - box.left, top: child.top - box.top, opacity: Number(ownStyle.opacity), transform: ownStyle.transform }; }),
        });
      }
      return samples;
    }, { startScroll });
    await writeFile(path.join(output, `${engine}-${width}-motion-frames.json`), JSON.stringify(frames, null, 2));
    const partial = frames.filter(frame => frame.opacity > .001 && frame.opacity < .999);
    assert(partial.length >= 3, `${engine}/${width}: actual gradual entrance was observed`);
    assert(Math.abs(partial[0].top - height * .85) < 32, `${engine}/${width}: entrance starts at top 85% of viewport`);
    const completed = frames.find(frame => frame.opacity >= .999 && Math.abs(frame.y) < .02);
    assert(completed, `${engine}/${width}: entrance completes`);
    const duration = completed.elapsed - partial[0].elapsed;
    assert(duration >= 250 && duration <= 850, `${engine}/${width}: short approximately 0.6s entrance (${duration.toFixed(0)}ms observed)`);
    for (const [index, frame] of frames.entries()) {
      assert(frame.y >= -.1 && frame.y <= 12.1, `${engine}/${width}: no overshoot`);
      assert(Math.abs(frame.opacity - (1 - frame.y / 12)) < .015, `${engine}/${width}: opacity and translation move as one composition`);
      if (index) assert(frame.opacity >= frames[index - 1].opacity - .005, `${engine}/${width}: no flicker or restart during entrance`);
      assert(frame.children.every((child, childIndex) => child.opacity === 1 && child.transform === 'none' && Math.abs(child.left - frames[0].children[childIndex].left) < 1.1 && Math.abs(child.top - frames[0].children[childIndex].top) < 1.1), `${engine}/${width}: all step content keeps its relative geometry and opacity`);
    }
    const accelerated = partial.find(frame => frame.elapsed - partial[0].elapsed >= 150);
    assert(accelerated && accelerated.opacity > .5, `${engine}/${width}: entrance decelerates rather than moving linearly`);
    await resting(page, `${engine}/${width}/completed`);
    assert.equal(await page.locator('.digital-flow').getAttribute('style'), '', `${engine}/${width}: completed animation clears its inline presentation`);
    const photoState = await page.locator('.precision-photo').evaluate(photo => ({
      pictureOpacity: Number(getComputedStyle(photo.querySelector('picture')).opacity),
      pictureY: new DOMMatrix(getComputedStyle(photo.querySelector('picture')).transform).m42,
      imageScale: new DOMMatrix(getComputedStyle(photo.querySelector('img')).transform).m11,
    }));
    assert(photoState.pictureOpacity === 1 && Math.abs(photoState.pictureY) < .1 && Math.abs(photoState.imageScale - 1) < .001, `${engine}/${width}: existing photograph entrance is completed independently`);

    // Once read, rapid scrolling, a responsive rebuild and preference changes cannot hide it again.
    for (const destination of [0, await page.evaluate(() => document.documentElement.scrollHeight), startScroll]) {
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), destination); await page.waitForTimeout(50);
      await resting(page, `${engine}/${width}/return`);
    }
    for (const viewport of [{ width: width < 1200 ? 1366 : 390, height }, { width, height }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(200);
      await resting(page, `${engine}/${width}/resize-${viewport.width}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduced');
    await resting(page, `${engine}/${width}/reduced`);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect(page.locator('body')).toHaveAttribute('data-motion', 'ready');
    await resting(page, `${engine}/${width}/restored-preference`);
    report.motion.push({ engine, width, observedEntranceMs: Math.round(duration), partialFrames: partial.length, startAt85Percent: true, composed: true, once: true, responsiveRebuild: true, reducedPreference: true, photographIndependent: true });
  } catch (error) {
    await page.locator('.precision').screenshot({ path: path.join(output, `${engine}-${width}-motion-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    if (video) { const filename = path.join(output, `${engine}-${width}-scroll.webm`); await video.saveAs(filename); report.videos.push(filename); }
  }

  // Jump directly across an unseen section: ScrollTrigger's onLeave must complete its entrance.
  const fastContext = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
  const fastPage = await fastContext.newPage(); monitor(fastPage, `${engine}/${width}/fast-scroll`);
  try {
    await visit(fastPage, 'ready');
    await fastPage.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await fastPage.waitForTimeout(150);
    await resting(fastPage, `${engine}/${width}/unseen-fast-scroll`);
    await fastPage.locator('.digital-flow').scrollIntoViewIfNeeded();
    await resting(fastPage, `${engine}/${width}/unseen-return`);
    report.motion.push({ engine, width, unseenFastScroll: true });
  } finally { await fastContext.close(); }
}

async function interruptedEntrance(browser, engine) {
  for (const interruption of ['breakpoint', 'reduced-motion']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    const page = await context.newPage(); monitor(page, `${engine}/interrupted-${interruption}`);
    try {
      await visit(page, 'ready');
      // Settle nearby lazy images before entering, so a busy first frame cannot skip
      // the intermediate state that this interruption deliberately needs to observe.
      await page.locator('.digital-flow').evaluate(flow => {
        const y = new DOMMatrix(getComputedStyle(flow).transform).m42;
        scrollTo({ top: flow.getBoundingClientRect().top + scrollY - y - innerHeight * .85 - 60, behavior: 'instant' });
      });
      await page.waitForTimeout(450);
      await page.locator('.digital-flow').evaluate(flow => {
        const y = new DOMMatrix(getComputedStyle(flow).transform).m42;
        scrollTo({ top: flow.getBoundingClientRect().top + scrollY - y - innerHeight * .7, behavior: 'instant' });
      });
      await page.waitForFunction(() => {
        const opacity = Number(getComputedStyle(document.querySelector('.digital-flow')).opacity);
        return opacity > .02 && opacity < .95;
      }, null, { polling: 'raf' });
      if (interruption === 'breakpoint') {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.locator('.digital-flow').scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
      } else {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduced');
      }
      await resting(page, `${engine}/interrupted-${interruption}`);
      await expect(page.locator('.digital-flow li')).toHaveCount(3);
      await expect(page.locator('.digital-flow')).toHaveCSS('transform', 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('.digital-flow').scrollIntoViewIfNeeded();
      await resting(page, `${engine}/interrupted-${interruption}-return`);
      report.motion.push({ engine, interruption, interruptedBeforeCompletion: true, cleanup: true, fullyVisibleAfterReturn: true });
    } finally { await context.close(); }
  }
}

const browsers = [];
try {
  for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await launcher.launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' } : {}) });
    browsers.push(browser);
    if (process.argv.includes('--interruptions-only')) {
      await interruptedEntrance(browser, engine);
      await browser.close();
      continue;
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); monitor(page, `${engine}/layout`);
    await visit(page);
    const copy = await copyAndPhoto(page); await writeFile(path.join(output, `${engine}-copy-after.json`), JSON.stringify(copy, null, 2));
    for (const width of widths) for (const scale of [1, 2]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : width < 600 ? 844 : width < 1200 ? 1112 : 1000 });
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
      await page.waitForTimeout(100);
      await geometry(page, engine, width, scale);
      await resting(page, `${engine}/${width}/${scale}/reduced`);
      if (scale === 1 && [390, 834, 1366].includes(width)) await capture(page, engine, width);
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'ready');
    await resting(page, `${engine}/initially-reduced-preference-restored`);
    report.motion.push({ engine, initiallyReducedThenEnabled: true, replayed: false });
    await context.close();
    for (const width of [390, 1366]) await motionCheck(browser, engine, width);
    await interruptedEntrance(browser, engine);
    for (const dpr of [2, 3]) for (const width of [390, 834, 1366]) {
      const densityContext = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      const densityPage = await densityContext.newPage(); monitor(densityPage, `${engine}/${width}/${dpr}x`);
      try {
        await visit(densityPage); await densityPage.locator('.precision-photo').scrollIntoViewIfNeeded();
        await densityPage.locator('.precision-photo img').evaluate(image => image.decode());
        await densityPage.waitForTimeout(150);
        const image = await densityPage.locator('.precision-photo img').evaluate(img => {
          const aspect = Number(img.getAttribute('width')) / Number(img.getAttribute('height'));
          const required = Math.max(img.clientWidth, img.clientHeight * aspect) * devicePixelRatio;
          const source = img.closest('picture').querySelector('source');
          const available = Math.max(...source.srcset.split(',').map(candidate => Number(candidate.trim().split(/\s+/).at(-1).replace('w', ''))));
          const selected = Number(img.currentSrc.match(/-(\d+)\.(avif|webp)/)?.[1]);
          return { required, available, selected, loaded: img.complete && img.naturalWidth > 0, alt: img.alt };
        });
        assert(image.loaded && image.selected >= Math.min(image.required, image.available) * .98, `${engine}/${width}/${dpr}x: crop receives an adequate existing image candidate`);
        await geometry(densityPage, engine, width, 1);
        report.density.push({ engine, width, dpr, ...image });
      } finally { await densityContext.close(); }
    }
    for (const width of [390, 1366]) {
      const noJsContext = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
      const noJsPage = await noJsContext.newPage(); monitor(noJsPage, `${engine}/${width}/no-JS`);
      try {
        await visit(noJsPage, null); await copyAndPhoto(noJsPage); await resting(noJsPage, `${engine}/${width}/no-JS`);
        await geometry(noJsPage, engine, width, 1);
        report.noJavaScript.push({ engine, width, contentVisible: true, orderedList: true, linkPreserved: true });
      } finally { await noJsContext.close(); }
    }
    await browser.close();
  }
  assert.deepEqual(report.errors, [], 'No uncaught browser errors');
  report.status = 'passed';
  console.log(`Precision flow passed: ${report.layouts.length} layouts, ${report.motion.length} motion scenarios, ${report.density.length} density checks and ${report.noJavaScript.length} no-JavaScript checks.`);
} catch (error) {
  report.status = 'failed'; report.failure = { message: error.message, stack: error.stack };
  for (const browser of browsers) for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    await page.locator('.digital-flow').screenshot({ path: path.join(output, 'failure-flow.png') }).catch(() => {});
  }
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  for (const browser of browsers) await browser.close().catch(() => {});
}
