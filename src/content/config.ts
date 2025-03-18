import { defineCollection, z } from 'astro:content';

const pixivCollection = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.number(),
    title: z.string(),
    caption: z.string(),
    author: z.object({
      id: z.number(),
      name: z.string(),
      account: z.string(),
      profile_image_url: z.string()
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

// 添加图片集合
const imagesCollection = defineCollection({
  type: 'data'
});

export const collections = {
  'pixiv': pixivCollection,
  'images': imagesCollection
}; 