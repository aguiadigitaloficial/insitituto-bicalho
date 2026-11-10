import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import {fileURLToPath} from 'node:url';
import {readFile, writeFile} from 'node:fs/promises';

let clientDir;
const candidateFiles = {name: 'bicalho-production-candidate', hooks: {
  'astro:config:done': ({config}) => {clientDir = config.build.client;},
  'astro:build:done': async () => {
    const redirects = JSON.parse(await readFile(new URL('./redirects.json', import.meta.url), 'utf8'));
    await writeFile(new URL('_redirects', clientDir), Object.entries(redirects).flatMap(([from, to]) => [`${from} ${to} 301`, `${from}/ ${to} 301`]).join('\n') + '\n');
    // Static assets bypass middleware. Protect the temporary host separately;
    // production HTML may be indexed only on the canonical domain.
    await writeFile(new URL('_headers', clientDir), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\nhttps://insitituto-bicalho.cbicalhogarcia.workers.dev/*\n  X-Robots-Tag: noindex, nofollow\n/404.html\n  X-Robots-Tag: noindex, nofollow\n/404/*\n  X-Robots-Tag: noindex, nofollow\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*\n  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n');
  }
}};

export default defineConfig({
  site: 'https://institutobicalho.com',
  output: 'static',
  outDir: './dist-cloudflare-production',
  cacheDir: './.astro/cloudflare-production',
  session: false,
  adapter: cloudflare({configPath: './wrangler.production.jsonc', imageService: 'passthrough', remoteBindings: false}),
  integrations: [candidateFiles],
  trailingSlash: 'always',
  build: {format: 'directory', inlineStylesheets: 'always'},
  devToolbar: {enabled: false},
  // Never load the preview's local .env files into this artifact.
  vite: {envDir: fileURLToPath(new URL('./.astro/production-env', import.meta.url)), resolve: {alias: {'@bicalho/images': fileURLToPath(new URL('./src/lib/blog/image-cloudflare.ts', import.meta.url))}}},
});
