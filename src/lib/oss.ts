const BUCKET_URL = 'https://lmd-oss.oss-cn-shenzhen.aliyuncs.com';

export const getOSSPath = (path: string) => {
  return `${BUCKET_URL}/${path}`;
};

export const getArtworkPath = (id: string, filename: string) => {
  return `sesese-se/artworks/${id}/${filename}`;
};

export const getAssetPath = (filename: string) => {
  return `sesese-se/assets/${filename}`;
}; 