import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  // 你的 Astro 配置
  image: {
    domains: [],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lmd-oss.oss-cn-shenzhen.aliyuncs.com',
        // 可选: pathname: '/sesese-se/**' // 如果想更精确地限制路径
      }
    ],
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