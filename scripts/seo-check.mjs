import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { exiftool } from 'exiftool-vendored';
import { mkdir, writeFile } from 'node:fs/promises';
import { media, photoWidths, photoCopyright } from '../src/data/photos.ts';

const base = process.env.TEST_URL || 'http://127.0.0.1:4321';
const officialIndexable = process.env.TEST_INDEXABLE === 'true' || new URL(base).hostname === 'institutobicalho.com';
const routes = ['/', '/tratamentos/', '/estetica/', '/ortodontia-e-cirurgia/', '/odontologia-de-precisao/', '/contato/', '/politica-de-privacidade/', '/termos-de-uso/', '/politica-de-cookies/', '/404.html'];
const placeIds = ['ChIJU1SbPXMHpQARw7UoLTBid8k', 'ChIJRWZqfhmXpgARwWg7SmnBfFY'];
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const results = [], images = [];
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  for (const route of routes) {
    const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    const data = await page.evaluate(() => {
      const meta = name => document.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.getAttribute('content');
      const schema = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(script => {
        const object = JSON.parse(script.textContent);
        return object['@graph'] || [object];
      });
      return {
        title: document.title, description: meta('description'), robots: meta('robots'),
        canonical: document.querySelector('link[rel="canonical"]').href,
        h1: document.querySelectorAll('h1').length,
        og: { title: meta('og:title'), description: meta('og:description'), image: meta('og:image'), alt: meta('og:image:alt'), width: meta('og:image:width'), height: meta('og:image:height') },
        twitter: { title: meta('twitter:title'), description: meta('twitter:description'), image: meta('twitter:image'), alt: meta('twitter:image:alt') },
        photos: [...document.querySelectorAll('.photo img')].map(img => ({ alt: img.alt, src: img.getAttribute('src') })), schema,
        reviews: [...document.querySelectorAll('.google-reviews-link')].map(link => link.href),
        directions: [...document.querySelectorAll('.directions-link')].map(link => link.href),
        maps: [...document.querySelectorAll('.unit-map iframe')].map(frame => frame.src),
      };
    });
    assert.equal(data.h1, 1, route);
    assert(data.title && data.description, route);
    assert.equal(new URL(data.canonical).pathname, route === '/404.html' ? '/404/' : route);
    const indexable = officialIndexable && route !== '/404.html';
    assert.equal(data.robots, indexable ? 'index, follow' : 'noindex, follow', route);
    if (indexable) assert(!/noindex|none/i.test(response.headers()['x-robots-tag'] || ''), `HTTP header blocks indexing: ${route}`);
    assert.equal(data.og.title, data.title);
    assert.equal(data.twitter.title, data.title);
    assert.equal(data.og.description, data.description);
    assert.equal(data.twitter.description, data.description);
    assert.equal(data.twitter.image, data.og.image);
    assert.equal(data.twitter.alt, data.og.alt);
    assert(data.og.alt);
    const cover = await sharp(`public${new URL(data.og.image).pathname}`).metadata();
    assert.equal(Number(data.og.width), cover.width);
    assert.equal(Number(data.og.height), cover.height);
    const dentists = data.schema.filter(item => item['@type'] === 'Dentist');
    assert.equal(dentists.length, 2);
    for (const [i, dentist] of dentists.entries()) {
      assert.equal(new URL(dentist.hasMap).searchParams.get('query_place_id'), placeIds[i]);
      assert.equal(dentist.sameAs[0], dentist.hasMap);
      assert.equal(typeof dentist.geo.latitude, 'number');
      assert.equal(typeof dentist.geo.longitude, 'number');
    }
    const imageObjects = data.schema.filter(item => item['@type'] === 'ImageObject');
    for (const photo of data.photos) {
      assert(photo.alt);
      assert(imageObjects.some(item => item.description === photo.alt && item.contentUrl.includes(photo.src.replace(/-1200.webp$/, '-1600.webp'))));
    }
    if (data.reviews.length) {
      assert.equal(data.reviews.length, 2);
      data.reviews.forEach((url, i) => assert.equal(new URL(url).searchParams.get('placeid'), placeIds[i]));
      data.directions.forEach((url, i) => assert.equal(new URL(url).searchParams.get('destination_place_id'), placeIds[i]));
      assert(data.maps.every(url => url.startsWith('https://www.google.com/maps/embed?pb=')));
    }
    results.push({ route, title: data.title, canonical: data.canonical, imageObjects: imageObjects.length, googleUnits: data.reviews.length });
  }
  assert.equal(new Set(results.map(item => item.title)).size, routes.length, 'Page titles must be unique');
  for (const photo of Object.values(media)) {
    for (const width of photoWidths(photo)) {
      for (const extension of ['webp', 'avif']) {
        const file = `public/assets/${photo.src}-${width}.${extension}`;
        const metadata = await sharp(file).metadata();
        assert.equal(metadata.width, width, file);
        const tags = await exiftool.read(file, { groupNames: true });
        assert.equal(tags['EXIF:Copyright'], photoCopyright, `${file}: copyright field`);
        assert.equal(tags['XMP:Rights'], photoCopyright, `${file}: XMP copyright`);
        assert.equal(tags['XMP:Rights-pt-BR'], photoCopyright, `${file}: Portuguese copyright`);
        // The newly requested copyright and the structural YCbCr default are public.
        // Do not reintroduce camera data, GPS, serial numbers or capture dates.
        assert.deepEqual(Object.keys(tags).filter(key => key.startsWith('EXIF:') && !['EXIF:Copyright','EXIF:YCbCrPositioning'].includes(key)), [], `${file}: private EXIF fields`);
        assert(metadata.xmp, `${file} is missing its photo description`);
        images.push({ file, xml: metadata.xmp.toString('utf8'), title: photo.title, description: photo.alt });
      }
    }
  }
  const invalidXmp = await page.evaluate(({ photos, copyright }) => photos.flatMap(photo => {
    const xml = new DOMParser().parseFromString(photo.xml, 'application/xml');
    const dc = 'http://purl.org/dc/elements/1.1/';
    const text = field => xml.getElementsByTagNameNS(dc, field)[0]?.textContent;
    return xml.querySelector('parsererror') || !text('title')?.includes(photo.title) || !text('description')?.includes(photo.description) || !text('rights')?.includes(copyright) ? [photo.file] : [];
  }), { photos: images, copyright: photoCopyright });
  assert.deepEqual(invalidXmp, []);
  await mkdir('artifacts/release-review', { recursive: true });
  await writeFile('artifacts/release-review/seo-verification.json', JSON.stringify({ pages: results, imageFiles: images.length, copyright: photoCopyright, invalidXmp }, null, 2));
  console.log(`PASS: ${routes.length} pages, canonical/OG/Twitter/JSON-LD, official Maps links, and ${images.length} WebP/AVIF files with verified XMP.`);
} finally {
  await browser.close();
  await exiftool.end();
}
