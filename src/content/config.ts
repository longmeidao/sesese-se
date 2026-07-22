import { defineCollection, z } from 'astro:content';

const variantSchema = z.object({
  key: z.string(),
  format: z.enum(['webp', 'avif', 'jpeg']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative().optional(),
});

const artworkSchema = z.object({
  schema_version: z.literal(2),
  id: z.string(),
  content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  display_image_index: z.number().int().positive().default(1),
  source: z.object({
    type: z.enum(['pixiv', 'danbooru', 'x', 'other']),
    id: z.string(),
    url: z.string().url(),
  }),
  title: z.string(),
  description: z.string(),
  published_at: z.string(),
  collected_at: z.string(),
  tags: z.array(z.string()),
  author: z.object({
    id: z.string(),
    name: z.string(),
    name_raw: z.string().optional(),
    handle: z.string().optional(),
    canonical_id: z.string().optional(),
    url: z.string().url(),
  }),
  media: z.array(z.object({
    index: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string().optional(),
    content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
    variants: z.array(variantSchema).min(1),
  })).min(1),
  metrics: z.object({
    views: z.number().int().nonnegative().optional(),
    bookmarks: z.number().int().nonnegative().optional(),
  }).optional(),
}).refine(
  (artwork) => artwork.media.some((item) => item.index === artwork.display_image_index),
  { message: 'display_image_index must refer to an item in media' },
);

const legacyPixivSchema = z.object({
  id: z.number(),
  title: z.string(),
  caption: z.string(),
  create_date: z.string(),
  tags: z.array(z.string()),
  page_count: z.number().int().positive(),
  author: z.object({
    id: z.number(),
    name: z.string(),
    account: z.string(),
    profile_image_url: z.string(),
  }),
  total_bookmarks: z.number().int().nonnegative(),
  total_view: z.number().int().nonnegative(),
  images: z.array(z.string()),
  is_muted: z.boolean(),
});

const artworks = defineCollection({
  type: 'data',
  schema: z.union([artworkSchema, legacyPixivSchema]),
});

export const collections = { artworks };
