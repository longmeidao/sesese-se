import { defineCollection, z } from 'astro:content';

const pixivCollection = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    caption: z.string(),
    author: z.object({
      id: z.string(),
      name: z.string(),
      account: z.string()
    }),
    tags: z.array(z.string()),
    create_date: z.string(),
    page_count: z.number(),
    width: z.number(),
    height: z.number(),
    total_view: z.number(),
    total_bookmarks: z.number(),
    is_bookmarked: z.boolean(),
    is_muted: z.boolean(),
    images: z.array(z.string())
  })
});

export const collections = {
  'pixiv': pixivCollection
}; 