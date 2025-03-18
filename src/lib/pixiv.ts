import type { PixivArtwork } from '../types/pixiv';

const PIXIV_COOKIE = process.env.PIXIV_COOKIE || '';

interface PixivResponse {
  body: {
    works: Array<{
      id: number;
      title: string;
      caption: string;
      tags: string[];
      create_date: string;
      width: number;
      height: number;
      page_count: number;
      total_view: number;
      total_bookmarks: number;
      is_bookmarked: boolean;
      user: {
        id: number;
        name: string;
        account: string;
        profile_image_urls: {
          medium: string;
        };
      };
      meta_single_page: {
        original_image_url: string;
      };
      meta_pages: Array<{
        image_urls: {
          original: string;
        };
      }>;
    }>;
  };
}

export async function fetchPixivArtworks(): Promise<PixivArtwork[]> {
  if (!PIXIV_COOKIE) {
    throw new Error('PIXIV_COOKIE environment variable is not set');
  }

  const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': PIXIV_COOKIE,
    'Referer': 'https://www.pixiv.net/',
    'Origin': 'https://www.pixiv.net'
  });

  try {
    const response = await fetch('https://www.pixiv.net/ajax/illust/discovery?mode=all&limit=100', {
      method: 'GET',
      headers,
      credentials: 'include',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: PixivResponse = await response.json();
    
    return data.body.works.map(work => ({
      id: work.id,
      title: work.title,
      caption: work.caption,
      tags: work.tags,
      create_date: work.create_date,
      width: work.width,
      height: work.height,
      page_count: work.page_count,
      total_view: work.total_view,
      total_bookmarks: work.total_bookmarks,
      is_bookmarked: work.is_bookmarked,
      author: {
        id: work.user.id,
        name: work.user.name,
        account: work.user.account,
        profile_image_url: work.user.profile_image_urls.medium
      },
      images: work.meta_pages.length > 0
        ? work.meta_pages.map(page => page.image_urls.original)
        : [work.meta_single_page.original_image_url]
    }));
  } catch (error) {
    console.error('Error fetching Pixiv artworks:', error);
    throw error;
  }
} 