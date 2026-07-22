export type ArtworkSource = 'pixiv' | 'danbooru' | 'x' | 'other';

export interface MediaVariant {
  key: string;
  format: 'webp' | 'avif' | 'jpeg';
  width: number;
  height: number;
  bytes?: number;
}

export interface ArtworkMedia {
  index: number;
  width: number;
  height: number;
  alt?: string;
  content_hash?: string;
  variants: MediaVariant[];
}

export interface Artwork {
  schema_version: 2;
  id: string;
  sequence: number;
  content_hash?: string;
  display_image_index: number;
  source: {
    type: ArtworkSource;
    id: string;
    url: string;
  };
  title: string;
  description: string;
  published_at: string;
  collected_at: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    name_raw?: string;
    handle?: string;
    canonical_id?: string;
    url: string;
  };
  media: ArtworkMedia[];
  metrics?: {
    views?: number;
    bookmarks?: number;
  };
}

export interface OrderedArtwork extends Artwork {
  position: number;
}

export interface LegacyPixivArtwork {
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
}
