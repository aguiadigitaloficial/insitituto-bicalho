import { z } from 'zod';

export const FRAME_RATIOS = { listing: 3 / 2, compact: 1, article: 4 / 3 } as const;
export type FrameContext = keyof typeof FRAME_RATIOS;
export const frameSchema = z.object({
  mode: z.enum(['cover', 'contain']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3),
}).strict();
export type Frame = z.infer<typeof frameSchema>;
export const imageFramingSchema = z.object({
  listing: frameSchema.optional(), compact: frameSchema.optional(), article: frameSchema.optional(),
}).strict();
export type ImageFraming = z.infer<typeof imageFramingSchema>;

export const defaultFrame = (): Frame => ({ mode: 'cover', x: 50, y: 50, zoom: 1 });
// Older snapshots have no framing. Invalid legacy values must never create invalid CSS.
export function resolveFrame(value?: unknown): Frame {
  const parsed = frameSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultFrame();
}

/** All coordinates are percentages of the frame, not of the intrinsic image. */
export function frameGeometry(imageWidth: number, imageHeight: number, context: FrameContext, value?: unknown) {
  const frame = resolveFrame(value), ratio = FRAME_RATIOS[context];
  const aspect = Number.isFinite(imageWidth) && imageWidth > 0 && Number.isFinite(imageHeight) && imageHeight > 0
    ? imageWidth / imageHeight : ratio;
  const fit = frame.mode === 'cover' ? Math.max : Math.min;
  // "Mostrar inteira" always retains the whole original. Zoom applies only to filling the frame.
  const zoom = frame.mode === 'cover' ? frame.zoom : 1;
  const width = fit(100, 100 * aspect / ratio) * zoom;
  const height = fit(100, 100 * ratio / aspect) * zoom;
  const x=frame.mode==='contain'?50:frame.x, y=frame.mode==='contain'?50:frame.y;
  return { width, height, left: (100 - width) * x / 100, top: (100 - height) * y / 100 };
}

export function frameStyle(imageWidth: number, imageHeight: number, context: FrameContext, frame?: unknown) {
  const geometry = frameGeometry(imageWidth, imageHeight, context, frame);
  return Object.entries(geometry).map(([key, value]) => `${key}:${Number(value.toFixed(6))}%`).join(';');
}

/** Preserve the media library and other uses of the same original; only this post's framing changes. */
export function resetImageFraming(
  snapshot: { coverId: string; thumbnailId: string; imageFraming?: ImageFraming },
  field: 'coverId' | 'thumbnailId', newId: string,
) {
  if (snapshot[field] === newId) return;
  snapshot[field] = newId;
  if (!snapshot.imageFraming) return;
  if (field === 'coverId') delete snapshot.imageFraming.article;
  if (field === 'thumbnailId' || !snapshot.thumbnailId) {
    delete snapshot.imageFraming.listing;
    delete snapshot.imageFraming.compact;
  }
  if (!Object.keys(snapshot.imageFraming).length) delete snapshot.imageFraming;
}

/** Account for the full image behind a crop when choosing responsive file sizes, including without JS. */
export function framedSizes(sizes: string, widthPercent: number) {
  const scale = widthPercent / 100;
  if (Math.abs(scale - 1) < 0.000001) return sizes;
  const parts: string[] = []; let start = 0, depth = 0;
  for (let i = 0; i <= sizes.length; i++) {
    if (sizes[i] === '(') depth++;
    if (sizes[i] === ')') depth--;
    if (i === sizes.length || (sizes[i] === ',' && depth === 0)) { parts.push(sizes.slice(start, i).trim()); start = i + 1; }
  }
  return parts.map(part => {
    let boundary = -1, nesting = 0;
    for (let i = 0; i < part.length; i++) {
      if (part[i] === '(') nesting++;
      else if (part[i] === ')') nesting--;
      else if (/\s/.test(part[i]) && nesting === 0) boundary = i;
    }
    const condition = boundary < 0 ? '' : part.slice(0, boundary + 1);
    const length = part.slice(boundary + 1).trim();
    return `${condition}calc((${length}) * ${Number(scale.toFixed(6))})`;
  }).join(', ');
}
