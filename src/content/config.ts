import { defineCollection, z } from 'astro:content';

const pixiv = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.number(),
    title: z.string(),
    caption: z.string(),
    create_date: z.string(),
    tags: z.array(z.string()),
    page_count: z.number(),
    author: z.object({
      id: z.number(),
      name: z.string(),
      account: z.string(),
      profile_image_url: z.string()
    }),
    total_bookmarks: z.number(),
    total_view: z.number(),
    images: z.array(z.string()),
    is_muted: z.boolean()
  })
});

// 添加图片集合
const imagesCollection = defineCollection({
  type: 'content'
});

export const collections = {
  pixiv,
  'images': imagesCollection
}; 