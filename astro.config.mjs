import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://institutobicalho.com',
  output: 'static',
  adapter: vercel({maxDuration:60}),
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  vite: {resolve: {alias: {'@bicalho/images': fileURLToPath(new URL('./src/lib/blog/image-node.ts', import.meta.url))}}},
});
