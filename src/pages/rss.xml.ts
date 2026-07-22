import type { APIRoute } from 'astro';
import { getArtworks, plainText, xmlEscape } from '../lib/artworks';
import { fallbackVariant, mediaUrl } from '../lib/media';

export const GET: APIRoute = async () => {
  const artworks = (await getArtworks()).reverse();
  const latestSequence = artworks[0]?.sequence;
  const latestDate = artworks[0]?.collected_at ?? new Date(0).toISOString();
  const items = artworks.map((artwork) => {
    const media = artwork.media.find((item) => item.index === artwork.display_image_index) || artwork.media[0];
    const image = mediaUrl(fallbackVariant(media).key);
    const link = artwork.sequence === latestSequence ? 'https://sesese.se/' : `https://sesese.se/${artwork.sequence}/`;
    const description = plainText(artwork.description);
    return `
      <item>
        <title>${xmlEscape(artwork.title)}</title>
        <link>${link}</link>
        <guid isPermaLink="true">${link}</guid>
        <pubDate>${new Date(artwork.collected_at).toUTCString()}</pubDate>
        <description><![CDATA[<p>${description}</p><img src="${image}" alt="" />]]></description>
      </item>`;
  }).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet href="/pretty-feed-v3.xsl" type="text/xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>色览</title>
    <link>https://sesese.se/</link>
    <description>从 Pixiv 与其他图站收集的个人线上藏品室</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date(latestDate).toUTCString()}</lastBuildDate>
    <atom:link href="https://sesese.se/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
