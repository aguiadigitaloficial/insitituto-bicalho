import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {exiftool} from 'exiftool-vendored';
import {getPlatformProxy, type PlatformProxy} from 'wrangler';
import type {ImagesBinding} from '@cloudflare/workers-types';
import {withCopyright} from '../src/lib/blog/image-metadata';
import {imageSource} from '../src/lib/blog/image-node';
import {cloudflareImageSource} from '../src/lib/blog/image-cloudflare-core';
import {COPYRIGHT} from '../src/lib/blog/model';

const dir = 'artifacts/blog-images'; await mkdir(dir, {recursive: true});
const report: any = {kind: 'Local image encoding, metadata and Cloudflare binding emulation; not a hosted quota test', cases: []};
let proxy: PlatformProxy<{IMAGES: ImagesBinding}> | undefined;
try {
  const photo = await readFile('public/assets/official-entrance-480.webp');
  const portrait = await sharp(photo).resize(240, 160).withExif({IFD0: {Copyright: 'Original'}, IFD3: {GPSLatitudeRef: 'N', GPSLatitude: '1/1 2/1 3/1'}}).withMetadata({orientation: 6}).jpeg().toBuffer();
  const alpha = await sharp({create: {width: 90, height: 60, channels: 4, background: {r: 0, g: 124, b: 133, alpha: 0.4}}}).png().toBuffer();
  for (const [name, input] of [['photo', photo], ['portrait', portrait], ['alpha', alpha]] as const) {
    const image = await imageSource(input);
    if (name === 'portrait') assert(image.height > image.width, 'EXIF orientation must normalize portrait dimensions');
    for (const format of ['webp', 'avif'] as const) {
      const variant = await image.variant(120, format), stamped = withCopyright(variant.bytes, format, COPYRIGHT, variant.width, variant.height);
      const target = `${dir}/${name}.${format}`; await writeFile(target, stamped);
      const before = await sharp(variant.bytes).raw().toBuffer(), after = await sharp(stamped).raw().toBuffer();
      assert.deepEqual(after, before, 'Adding copyright must not alter pixels or alpha');
      const metadata = await sharp(stamped).metadata(); assert.equal(metadata.width, variant.width); assert.equal(metadata.height, variant.height);
      const tags: any = await exiftool.read(target);
      assert.equal(tags.Rights, COPYRIGHT, JSON.stringify(tags));
      assert.equal(tags.Copyright, COPYRIGHT, JSON.stringify(tags));
      assert(!tags.GPSLatitude && !tags.GPSLongitude, 'Do not copy camera location metadata');
      report.cases.push({name, format, width: metadata.width, height: metadata.height, copyright: tags.Copyright, unchangedPixels: true});
    }
  }
  const raw = await sharp(photo).webp().toBuffer();
  assert.throws(() => withCopyright(Buffer.from('not an image'), 'avif', COPYRIGHT, 1, 1));
  assert.throws(() => withCopyright(raw.subarray(0, 25), 'webp', COPYRIGHT, 1, 1));
  assert.throws(() => withCopyright(raw, 'webp', '', 480, 320));
  proxy = await getPlatformProxy<{IMAGES: ImagesBinding}>({configPath: 'wrangler.jsonc', envFiles: [], persist: false, remoteBindings: false});
  const images = proxy.env.IMAGES as ImagesBinding;
  assert(images, 'Cloudflare Images binding must exist');
  for (const [name, input] of [['photo', photo], ['portrait', portrait]] as const) {
    const source = await cloudflareImageSource(input, images);
    if (name === 'portrait') assert(source.height > source.width, 'Cloudflare must normalize portrait orientation');
    for (const format of ['webp', 'avif'] as const) {
      const variant = await source.variant(120, format); assert(variant.width <= source.width);
      const stamped = withCopyright(variant.bytes, format, COPYRIGHT, variant.width, variant.height);
      const metadata = await sharp(stamped).metadata(); assert.equal(metadata.width, variant.width); assert.equal(metadata.height, variant.height);
      report.cases.push({engine: 'Cloudflare local binding', name, format, width: metadata.width, height: metadata.height});
    }
  }
  await assert.rejects(cloudflareImageSource(Buffer.from('<svg/>'), images));
  console.log(`PASS: ${report.cases.length} image cases; EXIF/XMP copyright, unchanged pixels/alpha, portrait orientation, Cloudflare Images emulation, invalid input and native size limits.`);
} finally {
  await proxy?.dispose(); await exiftool.end(); await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
}
