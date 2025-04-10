import { defineConfig } from 'astro/config';
import { passthroughImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
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
    // 移除 contentDir，因为它与自定义 service 同时使用时可能无效或冲突
    // contentDir: 'src/content',
    // 直接将 passthroughImageService() 的返回值赋给 service
    service: passthroughImageService()
  },
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    build: {
      assetsDir: 'assets',
    },
  },
}); 