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
    total_view: z.number(),
    total_bookmarks: z.number(),
    is_muted: z.boolean(),
    images: z.array(z.string()),
    width: z.number().optional(),
    height: z.number().optional(),
    sanity_level: z.number().optional(),
    x_restrict: z.number().optional(),
    series: z.any().optional(),
    meta_single_page: z.any().optional(),
    meta_pages: z.any().optional(),
    is_bookmarked: z.boolean().optional(),
    visible: z.boolean().optional(),
    updated_at: z.string().optional()
  })
});

// 添加图片集合
const imagesCollection = defineCollection({
  type: 'content'
});

export const collections = {
  'pixiv': pixivCollection,
  'images': imagesCollection
}; 