import assert from 'node:assert/strict';
import { emptySnapshot, type PublicPost, type Taxonomy } from '../src/lib/blog/model';
import { sitemapEntries, sitemapXml } from '../src/lib/blog/sitemap';
import { nav, site } from '../src/data/content';
import { legalPages } from '../src/data/legal';

const firstPublication = '2026-11-03T13:00:00.000Z';
const latestPublication = '2026-11-05T18:15:38.222745+00:00';
const publicPost = (id: string, options: { demo?: boolean; index?: boolean } = {}): PublicPost => ({
  id, slug: `artigo-${id}`, first_published_at: firstPublication, published_at: latestPublication,
  is_demo: options.demo ?? false,
  snapshot: { ...emptySnapshot(), authorId: `author-${id}`, categoryIds: [`category-${id}`],
    seo: { ...emptySnapshot().seo, index: options.index ?? true } },
});
const real = publicPost('real');
const hidden = publicPost('oculto', { index: false });
const demo = publicPost('demo', { demo: true });
const taxonomy = (id: string, kind: Taxonomy['kind']): Taxonomy => ({ id: `${kind}-${id}`, kind, name: id, slug: id, description: '' });
const taxonomies = ['real', 'oculto', 'demo', 'vazio'].flatMap(id => [taxonomy(id, 'author'), taxonomy(id, 'category'), taxonomy(id, 'tag')]);
const staticPaths = [...nav.map(item => item.href), ...legalPages.map(page => `/${page.slug}/`)];
const entriesFor = (posts: PublicPost[]) => sitemapEntries({ siteUrl: site.url, staticPaths, posts, taxonomies });
const paths = (posts: PublicPost[]) => entriesFor(posts).map(entry => new URL(entry.url).pathname);

assert.equal(site.url, 'https://institutobicalho.com');
assert.deepEqual(paths([real, hidden, demo]), [...staticPaths, '/conteudos/artigo-real/', '/conteudos/autor/real/', '/conteudos/categoria/real/']);
assert.equal(entriesFor([real, hidden, demo]).length, 13, 'Current static routes plus one eligible article, its author and category');
assert(entriesFor([real]).every(entry => new URL(entry.url).origin === site.url));
assert.equal(entriesFor([real]).find(entry => entry.url.endsWith('/artigo-real/'))?.lastmod, latestPublication, 'lastmod is the last public update, not the initial publication or a draft timestamp');
assert(entriesFor([real]).filter(entry => !entry.url.endsWith('/artigo-real/')).every(entry => !entry.lastmod), 'Do not invent dates for pages or archives');

// publicData reads published snapshots; removing a publication removes its archives when empty.
assert.deepEqual(paths([]), staticPaths, 'Withdrawn articles and now-empty archives leave the sitemap');
assert.deepEqual(paths([hidden, demo]), staticPaths, 'Noindex and demonstration posts cannot populate an archive');
const updated = structuredClone(real);
updated.published_at = '2026-11-10T13:00:00.000Z';
assert.equal(entriesFor([updated]).find(entry => entry.url.endsWith('/artigo-real/'))?.lastmod, updated.published_at);
updated.snapshot.seo.index = false;
assert.deepEqual(paths([updated]), staticPaths, 'Turning off indexing removes the article and its empty archives');

const second = { ...publicPost('second'), snapshot: { ...real.snapshot } };
assert(paths([second]).includes('/conteudos/autor/real/'), 'Author remains while another eligible publication uses it');
assert(paths([second]).includes('/conteudos/categoria/real/'));
const multiple = entriesFor([real, second]);
assert.equal(multiple.filter(entry => entry.url.endsWith('/autor/real/')).length, 1);
assert.equal(multiple.filter(entry => entry.url.endsWith('/categoria/real/')).length, 1);
assert(!multiple.some(entry => /\/(?:admin|previa|busca|tag)\//.test(entry.url)));

const duplicate = sitemapEntries({ siteUrl: site.url, staticPaths: ['/', '/', `${site.url}/`], posts: [real, real], taxonomies: [...taxonomies, ...taxonomies] });
assert.equal(new Set(duplicate.map(entry => entry.url)).size, duplicate.length, 'Every canonical URL occurs once');
assert.equal(duplicate.length, 4);
for (const path of ['https://preview.workers.dev/', '//external.invalid/', '/?q=busca', '/#fragment']) {
  assert.throws(() => sitemapEntries({ siteUrl: site.url, staticPaths: [path], posts: [], taxonomies: [] }), /canônicas/, 'Reject external URLs and noncanonical query/fragment variants');
}

const xml = sitemapXml(entriesFor([real]));
assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
assert(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
assert.equal((xml.match(/<loc>/g) || []).length, 13);
assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
assert(sitemapXml([{ url: `https://institutobicalho.com/um&dois<'\">/` }]).includes('um&amp;dois&lt;&apos;&quot;&gt;'));
console.log('Sitemap: public pages, eligibility, withdrawal, archives, canonical uniqueness, publication dates and XML escaping passed.');
