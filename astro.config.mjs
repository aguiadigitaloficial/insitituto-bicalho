import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://institutobicalho.com',
  output: 'static',
  adapter: vercel({maxDuration:60}),
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
});
