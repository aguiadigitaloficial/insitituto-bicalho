import type {ImagesBinding} from '@cloudflare/workers-types';
import type {ImageSource, ImageFormat, ImageVariant} from './image-types';

const stream = (input: Uint8Array) => new ReadableStream<Uint8Array>({start(controller) {controller.enqueue(input); controller.close();}}) as unknown as Parameters<ImagesBinding['info']>[0];
export async function cloudflareImageSource(input: Uint8Array, images: ImagesBinding): Promise<ImageSource> {
  const original = await images.info(stream(input));
  if (!('width' in original) || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(original.format)) throw new Error('Formato de imagem não permitido.');
  if (!original.width || !original.height || original.width * original.height > 60000000) throw new Error('A imagem excede o limite de 60 megapixels.');
  const convert = async (width: number, format: ImageFormat): Promise<ImageVariant> => {
    const output = await images.input(stream(input)).transform({width, fit: 'scale-down'}).output({format: `image/${format}`, quality: format === 'avif' ? 65 : 86, anim: false});
    if (output.contentType() !== `image/${format}`) throw new Error('O serviço não concluiu a conversão da imagem. Tente novamente.');
    const bytes = new Uint8Array(await output.response().arrayBuffer());
    const info = await images.info(stream(bytes));
    if (!('width' in info) || !info.width || !info.height) throw new Error('A imagem não pôde ser lida.');
    return {bytes, width: info.width, height: info.height, format};
  };
  // Read a normalized result so EXIF portrait orientation never swaps the site's dimensions.
  const largest = await convert(2936, 'webp');
  const aspect = largest.width / largest.height;
  const rotated = Math.abs(original.width / original.height - aspect) > Math.abs(original.height / original.width - aspect);
  const width = rotated ? original.height : original.width, height = rotated ? original.width : original.height;
  return {width, height, variant: (size, format) => format === 'webp' && size === largest.width ? Promise.resolve(largest) : convert(Math.min(size, width), format)};
}
