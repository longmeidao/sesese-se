import type { APIRoute } from 'astro';
import { getArtworks, xmlEscape } from '../lib/artworks';

export const GET: APIRoute = async () => {
  const artworks = await getArtworks();
  const staticPages = [
    ['https://sesese.se/', artworks.at(-1)?.collected_at],
    ['https://sesese.se/archive/', artworks.at(-1)?.collected_at],
    ['https://sesese.se/about/', undefined],
  ] as const;
  const urls = [
    ...staticPages.map(([url, date]) => ({ url, date })),
    ...artworks.map((artwork) => ({ url: `https://sesese.se/${artwork.order}/`, date: artwork.collected_at })),
  ];

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(({ url, date }) => `
  <url>
    <loc>${xmlEscape(url)}</loc>${date ? `
    <lastmod>${new Date(date).toISOString()}</lastmod>` : ''}
  </url>`).join('')}
</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
