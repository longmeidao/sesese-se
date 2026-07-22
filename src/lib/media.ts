import type { ArtworkMedia, MediaVariant } from '../types/artwork';

const DEFAULT_MEDIA_ORIGIN = 'https://media.sesese.se';

export const mediaOrigin = (
  import.meta.env.PUBLIC_MEDIA_ORIGIN || DEFAULT_MEDIA_ORIGIN
).replace(/\/$/, '');

export function mediaUrl(key: string): string {
  return `${mediaOrigin}/${key.replace(/^\//, '')}`;
}

export function variantsByFormat(media: ArtworkMedia, format: MediaVariant['format']) {
  return media.variants
    .filter((variant) => variant.format === format)
    .sort((a, b) => a.width - b.width);
}

export function srcset(media: ArtworkMedia, format: MediaVariant['format']): string | undefined {
  const variants = variantsByFormat(media, format);
  if (variants.length === 0) return undefined;
  return variants.map((variant) => `${mediaUrl(variant.key)} ${variant.width}w`).join(', ');
}

export function fallbackVariant(media: ArtworkMedia): MediaVariant {
  const preferred = variantsByFormat(media, 'webp');
  const candidates = preferred.length > 0 ? preferred : [...media.variants].sort((a, b) => a.width - b.width);
  return candidates.at(-1)!;
}
