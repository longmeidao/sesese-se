import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getArtworkPath, getOSSPath } from '../lib/oss';
import type { PixivArtwork } from '../types/pixiv';
import { execSync } from 'child_process';
import path from 'node:path';

export const GET: APIRoute = async () => {
  // 获取文件的 git commit 时间
  function getGitCommitTime(filePath: string): number {
    try {
      const output = execSync(`git log -1 --format=%ct ${filePath}`).toString().trim();
      return parseInt(output) * 1000; // 转换为毫秒
    } catch (error) {
      console.error(`Error getting git commit time for ${filePath}:`, error);
      return 0;
    }
  }

  const pixivCollection = await getCollection('pixiv');
  const artworks = [];

  // 遍历所有作品目录并获取文件信息
  for (const artworkDir of pixivCollection) {
    const artworkId = parseInt(artworkDir.id);
    const artworkData = artworkDir.data as unknown as PixivArtwork;
    if (artworkData && artworkData.id) {
      const filePath = path.join('src/content/pixiv', `${artworkDir.id}.json`);
      const commitTime = getGitCommitTime(filePath);
      artworks.push({
        ...artworkData,
        id: artworkId,
        commitTime
      });
    }
  }

  // 按 git commit 时间倒序排序
  artworks.sort((a, b) => {
    const timeA = a.commitTime || 0;
    const timeB = b.commitTime || 0;
    return timeB - timeA;
  });

  // 生成 RSS 内容
  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>色览</title>
    <link>https://sesese.se</link>
    <description>色览</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString()}</lastBuildDate>
    <atom:link href="https://sesese.se/rss.xml" rel="self" type="application/rss+xml" />
    ${artworks.map((artwork, index) => {
      const order = artworks.length - index;  // 计算 order，最新作品获得最大的 order
      const imageUrl = getOSSPath(getArtworkPath(artwork.id.toString(), `${artwork.id}_1.jpg`));
      const pubDate = new Date(artwork.commitTime + 8 * 60 * 60 * 1000).toUTCString();
      return `
    <item>
      <title>${artwork.title}</title>
      <link>https://sesese.se/${order}</link>
      <guid>https://sesese.se/${order}</guid>
      <pubDate>${pubDate}</pubDate>
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