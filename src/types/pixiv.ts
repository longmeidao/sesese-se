export interface PixivArtwork {
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
  author: {
    id: number;
    name: string;
    account: string;
    profile_image_url: string;
  };
  images: string[];
} 