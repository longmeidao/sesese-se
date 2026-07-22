import { getCollection } from 'astro:content';
import type { Artwork, LegacyPixivArtwork, OrderedArtwork } from '../types/artwork';

const legacyCollectedAt: Record<string, string> = {
  '123854352': '2025-03-24T17:34:08Z',
  '128255980': '2025-03-17T18:48:32Z',
  '128265340': '2025-03-18T06:17:25Z',
  '128378150': '2025-03-20T07:48:12Z',
  '128409880': '2025-03-21T19:05:04Z',
  '128700071': '2025-03-29T13:13:21Z',
};

function isLegacyArtwork(value: Artwork | LegacyPixivArtwork): value is LegacyPixivArtwork {
  return !('schema_version' in value);
}

function normalizeLegacyArtwork(legacy: LegacyPixivArtwork): Artwork {
  const id = String(legacy.id);
  const mediaCount = Math.max(legacy.images.length, legacy.page_count);

  return {
    schema_version: 2,
    id: `pixiv-${id}`,
    display_image_index: 1,
    source: {
      type: 'pixiv',
      id,
      url: `https://www.pixiv.net/artworks/${id}`,
    },
    title: legacy.title,
    description: legacy.caption,
    published_at: legacy.create_date,
    collected_at: legacyCollectedAt[id] || legacy.create_date,
    tags: legacy.tags,
    author: {
      id: String(legacy.author.id),
      name: legacy.author.name,
      handle: legacy.author.account,
      url: `https://www.pixiv.net/users/${legacy.author.id}`,
    },
    media: Array.from({ length: mediaCount }, (_, index) => ({
      index: index + 1,
      width: 1600,
      height: 1200,
      alt: `${legacy.title}${mediaCount > 1 ? ` · ${index + 1}/${mediaCount}` : ''}`,
      variants: [{
        key: `media/pixiv/${id}/${index + 1}/original.webp`,
        format: 'webp' as const,
        width: 1600,
        height: 1200,
      }],
    })),
    metrics: {
      views: legacy.total_view,
      bookmarks: legacy.total_bookmarks,
    },
  };
}

export async function getArtworks(): Promise<OrderedArtwork[]> {
  const entries = await getCollection('artworks');
  const artworks = entries
    .map((entry) => {
      const data = entry.data as Artwork | LegacyPixivArtwork;
      return isLegacyArtwork(data) ? normalizeLegacyArtwork(data) : data;
    })
    .sort((a, b) => Date.parse(a.collected_at) - Date.parse(b.collected_at));

  return artworks.map((artwork, index) => ({ ...artwork, order: index + 1 }));
}

export function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
