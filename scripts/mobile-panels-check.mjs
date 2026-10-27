import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const routes = ['/', '/tratamentos/', '/estetica/', '/ortodontia-e-cirurgia/', '/odontologia-de-precisao/'];
const sizes = [[360, 640], [390, 844], [430, 740]];
const errors = [], checks = [];
const base=process.env.TEST_URL||'http://127.0.0.1:4321';
const page = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
page.on('pageerror', error => errors.push(error.message));
const geometry = selector => page.locator(selector).evaluate(el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: innerWidth - r.right, top: r.top, bottom: r.bottom, height: r.height, client: el.clientHeight, scroll: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth };
});
for (const route of routes) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}${route}`);
    await page.waitForFunction(() => document.body.dataset.motion === 'ready');
    await page.locator('#primary-booking').click();
    await page.waitForTimeout(300);
    const booking = await geometry('#booking-dialog');
    assert(Math.abs(booking.left - booking.right) < 1, 'Booking must be centered');
    assert(booking.scroll <= booking.client + 1, `Booking requires scrolling at ${width} × ${height}`);
    assert(booking.top >= 0 && booking.bottom <= height, 'Booking clipped by viewport');
    assert.equal(await page.locator('#booking-dialog [data-online-booking]').count(), 0);
    assert.equal(await page.locator('[data-booking-units] [data-whatsapp]').count(), 2);
    await page.locator('.dialog-close').click();
    await page.locator('.assistant-launcher').click();
    const assistant = await geometry('#support-dialog');
    assert(Math.abs(assistant.left - assistant.right) < 1, 'Assistant must have equal side margins');
    assert(assistant.bottom <= height && assistant.top >= 0, 'Assistant clipped by viewport');
    assert(assistant.width >= assistant.scrollWidth && assistant.scroll <= assistant.client + 1, 'Only conversation should scroll');
    assert(await page.locator('#support-dialog button').evaluateAll(buttons => buttons.every(el => el.getBoundingClientRect().height >= 44)), 'Touch targets must be at least 44px');
    await page.getByRole('button', { name: 'Tenho dúvidas', exact: true }).click();
    const current = await page.locator('#support-history .chat-assistant').last().boundingBox();
    const surface = await page.locator('.support-scroll').boundingBox();
    assert(current.y >= surface.y - 1 && current.y + current.height <= surface.y + surface.height, 'Current response must be visible');
    await page.locator('[data-support-close]').click();
    checks.push({ route, viewport: [width, height], booking, assistant });
  }
}

// Photo frames stay stationary; the reveal follows viewport entry and never replays.
for (const route of routes) {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto(`${base}${route}`);
  await page.waitForFunction(() => document.body.dataset.motion === 'ready');
  const photo = page.locator('.hero-photo, .inner-hero-photo').first();
  const top = await photo.evaluate(el => el.getBoundingClientRect().top + scrollY);
  const opacity = () => photo.locator('picture').evaluate(el => Number(getComputedStyle(el).opacity));
  if (top > 480 * .82) assert.equal(await opacity(), 0);
  await photo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  assert.equal(await opacity(), 1);
  assert.equal(await photo.evaluate(el => getComputedStyle(el).transform), 'none');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.setViewportSize({ width: 360, height: 520 });
  assert.equal(await opacity(), 1, 'Viewport changes must not replay the photograph');
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base+'/');
await page.locator('.assistant-launcher').click();
await page.getByRole('button', { name: 'Quero agendar', exact: true }).click();
await page.getByRole('button', { name: 'Belo Horizonte', exact: true }).click();
assert.equal(await page.locator('#support-actions [data-online-booking]').count(), 0);

await page.locator('#support-note').focus();
// Shrinking the visual viewport exercises the keyboard resize handler; real-device keyboard testing remains useful.
await page.setViewportSize({ width: 390, height: 420 });
await page.waitForTimeout(250);
const keyboard = await geometry('#support-dialog');
assert(keyboard.bottom <= 420 && Math.abs(keyboard.left - keyboard.right) < 1);
const note = await page.locator('#support-note').boundingBox();
const surface = await page.locator('.support-scroll').boundingBox();
assert(note.y >= surface.y - 1 && note.y + note.height <= surface.y + surface.height, 'Keyboard obscures the note field');
await page.locator('[data-support-reset]').click();
await page.addStyleTag({ content: 'html{font-size:200%}' });
assert((await geometry('#support-dialog')).scrollWidth <= (await geometry('#support-dialog')).width);
await page.keyboard.press('Escape');
await page.locator('#primary-booking').click();
assert((await geometry('#booking-dialog')).scrollWidth <= (await geometry('#booking-dialog')).width);
await page.keyboard.press('Escape');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForFunction(() => document.body.dataset.motion === 'reduced');
assert(await page.locator('main .photo picture').evaluateAll(els => els.every(el => Number(getComputedStyle(el).opacity) === 1)));
assert.deepEqual(errors, []);
await writeFile('artifacts/mobile-panels-verification.json', JSON.stringify({ checks, revealedPhotos: routes.length, keyboard, errors }, null, 2));
await browser.close();
console.log('PASS: 15 mobile page/panel checks, five viewport-triggered opening photos, no replay, keyboard viewport and enlarged text.');
