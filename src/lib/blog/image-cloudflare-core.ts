import type {ImagesBinding} from '@cloudflare/workers-types';
import type {ImageSource, ImageFormat, ImageVariant} from './image-types';

const stream = (input: Uint8Array) => new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(input); controller.close();}}) as unknown as Parameters<ImagesBinding['info']>[0];
export async function cloudflareImageSource(input: Uint8Array, images: ImagesBinding): Promise<ImageSource> {
  const original = await images.info(stream(input));
  if (!('width' in original) || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(original.format)) throw new Error('Formato de imagem não permitido.');
  if (!original.width || !original.height || original.width * original.height > 60000000) throw new Error('A imagem excede o limite de 60 megapixels.');
  const convert = async (width: number, format: ImageFormat): Promise<ImageVariant | null> => {
    const output = await images.input(stream(input)).transform({width, fit: 'scale-down'}).output({format: `image/${format}`, quality: format === 'avif' ? 65 : 86, anim: false});
    const actualType = output.contentType().split(';')[0].trim().toLowerCase();
    if (actualType !== `image/${format}`) {
      // Cloudflare may fall back to WebP/JPEG for AVIF. Never write those bytes to an .avif file.
      if (format === 'avif' && ['image/webp','image/jpeg'].includes(actualType)) {await output.response().body?.cancel(); return null;}
      throw new Error('O serviço não concluiu a conversão da imagem. Tente novamente.');
    }
    const bytes = new Uint8Array(await output.response().arrayBuffer());
    const info = await images.info(stream(bytes));
    if (!('width' in info) || !info.width || !info.height) throw new Error('A imagem não pôde ser lida.');
    return {bytes, width: info.width, height: info.height, format};
  };
  // Read a normalized result so EXIF portrait orientation never swaps the site's dimensions.
  const largest = await convert(2936, 'webp');
  if (!largest) throw new Error('A imagem não pôde ser lida.');
  const aspect = largest.width / largest.height;
  const rotated = Math.abs(original.width / original.height - aspect) > Math.abs(original.height / original.width - aspect);
  const width = rotated ? original.height : original.width, height = rotated ? original.width : original.height;
  return {width, height, variant: (size, format) => {
    const target = Math.min(size, width);
    // AVIF output is capped at 1200 pixels on either axis; WebP retains the full native size.
    if (format === 'avif' && Math.max(target,Math.ceil(target*height/width)) > 1200) return Promise.resolve(null);
    return format === 'webp' && target === largest.width ? Promise.resolve(largest) : convert(target, format);
  }};
}
