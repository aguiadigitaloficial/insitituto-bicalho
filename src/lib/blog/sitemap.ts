import type { PublicPost, Taxonomy } from './model';

export type SitemapEntry = { url: string; lastmod?: string };
type SitemapInput = {
  siteUrl: string;
  staticPaths: readonly string[];
  // Only the published snapshots returned by publicData belong in this input.
  posts: readonly PublicPost[];
  taxonomies: readonly Taxonomy[];
};

export function sitemapEntries({ siteUrl, staticPaths, posts, taxonomies }: SitemapInput): SitemapEntry[] {
  const origin = new URL(siteUrl).origin;
  const entries = new Map<string, SitemapEntry>();
  const add = (path: string, lastmod?: string) => {
    const url = new URL(path, origin);
    if (url.origin !== origin || url.search || url.hash) {
      throw new Error('O sitemap aceita somente URLs canônicas do site.');
    }
    const entry: SitemapEntry = { url: url.href };
    if (lastmod && Number.isFinite(Date.parse(lastmod))) entry.lastmod = lastmod;
    const previous = entries.get(entry.url);
    if (!previous || (entry.lastmod && (!previous.lastmod || Date.parse(entry.lastmod) > Date.parse(previous.lastmod)))) {
      entries.set(entry.url, entry);
    }
  };

  staticPaths.forEach(path => add(path));
  const eligible = posts.filter(post => !post.is_demo && post.snapshot.seo.index);
  for (const post of eligible) add(`/conteudos/${post.slug}/`, post.published_at);
  for (const taxonomy of taxonomies) {
    const used = taxonomy.kind === 'author'
      ? eligible.some(post => post.snapshot.authorId === taxonomy.id)
      : taxonomy.kind === 'category' && eligible.some(post => post.snapshot.categoryIds.includes(taxonomy.id));
    if (used) add(`/conteudos/${taxonomy.kind === 'author' ? 'autor' : 'categoria'}/${taxonomy.slug}/`);
  }
  return [...entries.values()];
}

const xml = (value: string) => value.replace(/[<>&'"]/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
}[character]!));

export function sitemapXml(entries: readonly SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<url><loc>${xml(entry.url)}</loc>${entry.lastmod ? `<lastmod>${xml(entry.lastmod)}</lastmod>` : ''}</url>`).join('')}</urlset>`;
}
