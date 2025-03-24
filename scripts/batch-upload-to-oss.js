import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new OSS({
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  region: process.env.OSS_REGION,
  secure: true
});

// 上传单个文件到 OSS
async function uploadFile(filePath, ossPath) {
  try {
    console.log(`Uploading ${filePath} to OSS...`);
    await client.put(ossPath, filePath);
    console.log(`Successfully uploaded ${filePath}`);
  } catch (error) {
    console.error(`Failed to upload ${filePath}:`, error);
    throw error;
  }
}

// 上传静态资源
async function uploadAssets() {
  const publicDir = path.join(__dirname, '..', 'public');
  const assetsDir = path.join(publicDir, 'assets');
  const ossAssetsPath = 'sesese-se/assets';

  // 确保 assets 目录存在
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 上传静态资源
  const assets = ['bg.jpg', 'dao.png', 'se.png'];
  for (const asset of assets) {
    const filePath = path.join(publicDir, asset);
    if (fs.existsSync(filePath)) {
      await uploadFile(filePath, `${ossAssetsPath}/${asset}`);
    } else {
      console.warn(`Asset file not found: ${filePath}`);
    }
  }
}

// 上传作品图片
async function uploadArtworks() {
  const sourceDir = path.join(__dirname, '..', 'src', 'content', 'images', 'pixiv');
  const ossArtworksPath = 'sesese-se/artworks';

  if (!fs.existsSync(sourceDir)) {
    console.warn(`Artworks directory not found: ${sourceDir}`);
    return;
  }

  const files = fs.readdirSync(sourceDir);
  console.log(`Found ${files.length} files in pixiv directory`);
  
  // 按作品ID分组文件
  const artworkGroups = {};
  for (const file of files) {
    if (file.startsWith('author_')) continue; // 跳过作者头像
    
    const match = file.match(/^(\d+)_(\d+)\.jpg$/);
    if (match) {
      const artworkId = match[1];
      if (!artworkGroups[artworkId]) {
        artworkGroups[artworkId] = [];
      }
      artworkGroups[artworkId].push(file);
    }
  }
  
  console.log(`Found ${Object.keys(artworkGroups).length} artworks`);
  
  // 上传每个作品的所有图片
  for (const [artworkId, artworkFiles] of Object.entries(artworkGroups)) {
    console.log(`Processing artwork ${artworkId} with ${artworkFiles.length} files`);
    const ossArtworkPath = `${ossArtworksPath}/${artworkId}`;
    
    for (const file of artworkFiles) {
      const filePath = path.join(sourceDir, file);
      const ossFilePath = `${ossArtworkPath}/${file}`;
      console.log(`Uploading ${filePath} to ${ossFilePath}`);
      await uploadFile(filePath, ossFilePath);
    }
  }
}

// 主函数
async function main() {
  try {
    console.log('Starting batch upload to OSS...');
    
    // 上传静态资源
    console.log('\nUploading static assets...');
    await uploadAssets();
    
    // 上传作品图片
    console.log('\nUploading artwork images...');
    await uploadArtworks();
    
    console.log('\nBatch upload completed successfully');
  } catch (error) {
    console.error('Batch upload failed:', error);
    process.exit(1);
  }
}

main(); 