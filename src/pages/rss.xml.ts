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

  // 生成 RSS feed
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Sesese</title>
    <link>https://sesese.se</link>
    <description>Pixiv Artwork Collection</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://sesese.se/rss.xml" rel="self" type="application/rss+xml" />
    ${artworks.map((artwork, index) => `
    <item>
      <title>${artwork.title}</title>
      <link>https://sesese.se/${index + 1}</link>
      <guid>https://sesese.se/${index + 1}</guid>
      <pubDate>${new Date(artwork.create_date).toUTCString()}</pubDate>
      <description><![CDATA[<img src="https://sesese.se/content/images/pixiv/${artwork.id}_1.jpg" alt="${artwork.title}" />]]></description>
      <content:encoded><![CDATA[<img src="https://sesese.se/content/images/pixiv/${artwork.id}_1.jpg" alt="${artwork.title}" />]]></content:encoded>
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml'
    }
  });
}; 