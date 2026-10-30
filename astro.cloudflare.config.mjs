import {defineConfig} from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import {fileURLToPath} from 'node:url';
import {readFile, writeFile} from 'node:fs/promises';

let clientDir;
const previewFiles = {name: 'bicalho-cloudflare-preview', hooks: {
  'astro:config:done': ({config}) => {clientDir = config.build.client;},
  'astro:build:done': async () => {
    const redirects = JSON.parse(await readFile(new URL('./redirects.json', import.meta.url), 'utf8'));
    await writeFile(new URL('_redirects', clientDir), Object.entries(redirects).flatMap(([from, to]) => [`${from} ${to} 301`, `${from}/ ${to} 301`]).join('\n') + '\n');
    await writeFile(new URL('_headers', clientDir), '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*\n  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n');
  }
}};

// A separate build leaves the current Vercel configuration and output intact.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://institutobicalho.com',
  output: 'static',
  outDir: './dist-cloudflare',
  cacheDir: './.astro/cloudflare',
  session: false,
  adapter: cloudflare({configPath: process.env.BICALHO_WRANGLER_CONFIG || './wrangler.jsonc', imageService: 'passthrough', remoteBindings: false}),
  integrations: [previewFiles],
  trailingSlash: 'always',
  build: {format: 'directory', inlineStylesheets: 'always'},
  server: {host: '127.0.0.1', port: 4326},
  devToolbar: {enabled: false},
  vite: {resolve: {alias: {'@bicalho/images': fileURLToPath(new URL('./src/lib/blog/image-cloudflare.ts', import.meta.url))}}},
});
