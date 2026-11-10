// Only the canonical production host may expose indexable pages.
// Static pages use Astro's configured site during prerendering; their temporary
// workers.dev URL is separately protected by the generated asset headers.
export function isIndexableHost(hostname: string, enabled: string, environment: string): boolean {
  return hostname.toLowerCase() === 'institutobicalho.com' && enabled === 'true' && environment === 'production';
}

export function isPrivateIndexingPath(pathname: string): boolean {
  return /^\/(?:admin|api|404)(?:\/|$)/.test(pathname) || pathname === '/404.html' || /^\/conteudos\/(?:busca|tag|previa)(?:\/|$)/.test(pathname);
}
