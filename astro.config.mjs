import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  // 你的 Astro 配置
  image: {
    domains: [],
    remotePatterns: [],
    // 确保 Astro 能识别内容目录中的图片
    contentDir: 'src/content'
  },
  output: 'static',
  vite: {
    build: {
      assetsDir: 'assets',
    },
  },
}); 