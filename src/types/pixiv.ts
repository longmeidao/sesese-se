export interface PixivArtwork {
  id: number;
  title: string;
  caption: string;
  create_date: string;
  tags: string[];
  page_count: number;
  total_view: number;
  total_bookmarks: number;
  is_muted: boolean;
  author: {
    id: number;
    name: string;
    account: string;
    profile_image_url: string;
  };
  images: string[];
  fileCreatedTime?: number;
} 