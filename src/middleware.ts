import {defineMiddleware} from 'astro:middleware';
import {env} from './lib/blog/server';
import {isIndexableHost, isPrivateIndexingPath} from './lib/indexing';

export const onRequest = defineMiddleware(async (context, next) => {
  if (env('BLOG_HOST') !== 'cloudflare') return next();
  const blockIndexing = !isIndexableHost(context.url.hostname, env('PUBLIC_INDEXABLE'), env('BLOG_ENVIRONMENT')) || isPrivateIndexingPath(context.url.pathname);
  const publicPage = context.request.method === 'GET' && /^\/conteudos\/(?!previa(?:\/|$))/.test(context.url.pathname) && !context.request.headers.has('cookie');
  const cache = publicPage && typeof caches !== 'undefined' ? (caches as CacheStorage & {default?: Cache}).default : undefined;
  // Do not reuse public HTML cached under the old global noindex policy.
  const cacheUrl = new URL(context.url);
  cacheUrl.searchParams.set('__bicalho_cache', `indexing-v2-${blockIndexing ? 'blocked' : 'public'}`);
  const key = new Request(cacheUrl, {method: 'GET'});
  let cached: Response | undefined;
  try {cached = await cache?.match(key);} catch { /* Render public pages when the optional cache is unavailable. */ }
  if (cached) {const response = new Response(cached.body, cached); response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=30, must-revalidate'); if (blockIndexing) response.headers.set('X-Robots-Tag', 'noindex, nofollow'); return response;}
  const original = await next();
  const response = new Response(original.body, original);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (blockIndexing || response.status === 404) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (cache && response.status === 200 && response.headers.get('Cache-Control')?.startsWith('public,') && !response.headers.has('set-cookie')) {
    const stored = response.clone(); stored.headers.set('Cache-Control', 'public, max-age=30');
    try {await cache.put(key, stored);} catch { /* Keep the uncached response available. */ }
  }
  return response;
});
