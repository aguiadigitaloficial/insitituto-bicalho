import sharp from 'sharp';
import type {ImageSource} from './image-types';

// Used by local Node development and the retained Vercel build only.
export async function imageSource(input: Uint8Array): Promise<ImageSource> {
  const m = await sharp(input, {limitInputPixels: 60000000}).metadata();
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(m.format || '')) throw new Error('Formato de imagem não permitido.');
  const width = m.autoOrient?.width || m.width || 0, height = m.autoOrient?.height || m.height || 0;
  if (!width || !height) throw new Error('A imagem não pôde ser lida.');
  return {width, height, async variant(size, format) {
    const {data, info} = await sharp(input, {limitInputPixels: 60000000}).rotate().resize({width: size, withoutEnlargement: true}).toFormat(format, {quality: format === 'avif' ? 65 : 86}).toBuffer({resolveWithObject: true});
    return {bytes: data, width: info.width, height: info.height, format};
  }};
}
