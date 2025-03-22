import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const pixivCollection = await getCollection('pixiv');
  const artworks: any[] = [];

  // 遍历所有作品目录并按创建日期排序
  for (const artworkDir of pixivCollection) {
    const artworkId = parseInt(artworkDir.id);
    const artworkData = artworkDir.data as unknown as any;
    if (artworkData && artworkData.id) {
      artworks.push({
        ...artworkData,
        id: artworkId
      });
    }
  }

  // 按创建日期倒序排序
  artworks.sort((a, b) => 
    new Date(b.create_date).getTime() - new Date(a.create_date).getTime()
  );

  // 生成 sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://sesese.se/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://sesese.se/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  ${artworks.map((artwork, index) => `
  <url>
    <loc>https://sesese.se/${index + 1}</loc>
    <lastmod>${new Date(artwork.create_date).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`).join('')}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml'
    }
  });
}; 