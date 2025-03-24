const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

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

  const artworkDirs = fs.readdirSync(sourceDir);
  
  for (const artworkDir of artworkDirs) {
    const artworkPath = path.join(sourceDir, artworkDir);
    if (fs.statSync(artworkPath).isDirectory()) {
      const ossArtworkPath = `${ossArtworksPath}/${artworkDir}`;
      const files = fs.readdirSync(artworkPath);
      
      for (const file of files) {
        const filePath = path.join(artworkPath, file);
        const ossFilePath = `${ossArtworkPath}/${file}`;
        await uploadFile(filePath, ossFilePath);
      }
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