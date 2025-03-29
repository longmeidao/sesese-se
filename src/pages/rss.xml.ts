import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getArtworkPath, getOSSPath } from '../lib/oss';
import type { PixivArtwork } from '../types/pixiv';
import fs from 'node:fs';
import path from 'node:path';

export const GET: APIRoute = async () => {
  const pixivCollection = await getCollection('pixiv');
  const artworks = [];

  // 遍历所有作品目录并获取文件信息
  for (const artworkDir of pixivCollection) {
    const artworkId = parseInt(artworkDir.id);
    const artworkData = artworkDir.data as unknown as PixivArtwork;
    if (artworkData && artworkData.id) {
      const filePath = path.join(process.cwd(), 'src/content/pixiv', `${artworkDir.id}.json`);
      const stats = fs.statSync(filePath);
      artworks.push({
        ...artworkData,
        id: artworkId,
        fileCreatedTime: stats.birthtime.getTime()
      });
    }
  }

  // 按文件创建时间倒序排序
  artworks.sort((a, b) => b.fileCreatedTime - a.fileCreatedTime);

  // 生成 RSS 内容
  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>色览</title>
    <link>https://sesese.se</link>
    <description>色览</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://sesese.se/rss.xml" rel="self" type="application/rss+xml" />
    ${artworks.map((artwork, index) => {
      const order = artworks.length - index;  // 计算 order，最新作品获得最大的 order
      const imageUrl = getOSSPath(getArtworkPath(artwork.id.toString(), `${artwork.id}_1.jpg`));
      return `
    <item>
      <title>${artwork.title}</title>
      <link>https://sesese.se/${order}</link>
      <guid>https://sesese.se/${order}</guid>
      <pubDate>${new Date(artwork.fileCreatedTime).toUTCString()}</pubDate>
      <description><![CDATA[<img src="${imageUrl}" alt="${artwork.title}" />]]></description>
    </item>`;
    }).join('')}
  </channel>
</rss>`;

  return new Response(rssContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml'
    }
  });
}; 