import {env} from 'cloudflare:workers';
import type {ImagesBinding} from '@cloudflare/workers-types';
import {cloudflareImageSource} from './image-cloudflare-core';
export async function imageSource(input: Uint8Array) {
  if (!env.IMAGES) throw new Error('Conecte o serviço de imagens no ambiente de teste.');
  return cloudflareImageSource(input, env.IMAGES as ImagesBinding);
}
