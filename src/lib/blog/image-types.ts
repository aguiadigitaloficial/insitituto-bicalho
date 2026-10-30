export type ImageFormat = 'webp' | 'avif';
export type ImageVariant = {bytes: Uint8Array; width: number; height: number; format: ImageFormat};
export type ImageSource = {width: number; height: number; variant: (width: number, format: ImageFormat) => Promise<ImageVariant | null>};
