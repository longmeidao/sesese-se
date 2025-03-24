const BUCKET_URL = 'https://lmd-oss.oss-cn-shenzhen.aliyuncs.com';

export const getOSSPath = (path: string) => {
  return `${BUCKET_URL}/${path}`;
};

export const getArtworkPath = (id: string, filename: string, format: 'jpg' | 'webp' = 'jpg') => {
  const basePath = `sesese-se/artworks/${id}`;
  if (format === 'webp') {
    const webpFilename = filename.replace('.jpg', '.webp');
    return `${basePath}/${webpFilename}`;
  }
  return `${basePath}/${filename}`;
};

export const getAssetPath = (filename: string, format: 'jpg' | 'webp' = 'jpg') => {
  const basePath = 'sesese-se/assets';
  if (format === 'webp') {
    const webpFilename = filename.replace('.jpg', '.webp');
    return `${basePath}/${webpFilename}`;
  }
  return `${basePath}/${filename}`;
}; 