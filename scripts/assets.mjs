import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mkdir, access } from 'node:fs/promises';
const dir = new URL('../public/assets/', import.meta.url);
const sources = new URL('../assets/originals/', import.meta.url);
await mkdir(dir, { recursive: true });
await mkdir(sources, { recursive: true });
const inputs = ['smile.png', 'hero.png', 'precision.png', 'partner-01.jpg', 'partner-02.jpg', 'professional-01.jpg'];
// Original photographs are private local sources, not needed for npm ci/build or deployment.
for (const filename of inputs) {
  const name = filename.replace(/\.(png|jpg)$/, '');
  const original = new URL(filename, sources);
  try { await access(original); } catch { throw new Error('Place the original in assets/originals/' + filename + ' before regenerating images. The deploy uses the checked-in public/assets files.'); }
  const input = fileURLToPath(original);
  for (const width of [480, 800, 1200, 1600]) {
    await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(fileURLToPath(new URL(`${name}-${width}.webp`, dir)));
    await sharp(input).rotate().resize({ width, withoutEnlargement: true }).avif({ quality: 55, effort: 3 }).toFile(fileURLToPath(new URL(`${name}-${width}.avif`, dir)));
  }
  console.log('Optimized', name);
}
const logo = fileURLToPath(new URL('logo-original.png', sources));
// Only remove blank margins and resize; preserve the supplied artwork.
await sharp(logo).trim({ threshold: 25 }).resize({ width: 600 }).png().toFile(fileURLToPath(new URL('logo.png', dir)));
await sharp(logo).trim({ threshold: 25 }).resize({ width: 600 }).webp({quality:90}).toFile(fileURLToPath(new URL('logo.webp', dir)));
// Keep the original site's rounded favicon artwork intact; PNG is a small fallback.
await sharp(fileURLToPath(new URL('favicon-bicalho.svg', dir))).resize(50,50).png().toFile(fileURLToPath(new URL('favicon-bicalho-50.png', dir)));


await sharp(fileURLToPath(new URL('logo.webp', dir))).resize({width:320}).webp({quality:88}).toFile(fileURLToPath(new URL('logo-320.webp', dir)));
// The in-page symbol is independent of the browser favicon.
const brandSymbol = await sharp(logo).extract({ left: 308, top: 485, width: 362, height: 365 }).resize(96,96,{fit:'contain',background:'#fff'}).png().toBuffer();
await sharp(brandSymbol).resize(64,64).webp({quality:88}).toFile(fileURLToPath(new URL('brand-symbol.webp', dir)));
