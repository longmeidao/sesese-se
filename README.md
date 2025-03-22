# sesese-se

一个优雅的 Pixiv 图片展示网站，使用 Astro 构建。

## 特点

- 🎨 优雅的图片展示界面
- 🔄 自动获取 Pixiv 图片
- 📱 响应式设计
- 🚀 基于 Astro 构建
- 🤖 使用 GitHub Actions 自动部署

## 样式参考

本站样式参考于 [Artab](https://github.com/get-artab/artab)，一个展示世界名画的新标签页扩展。

## 开发工具

大部分的代码编写工作由 [Cursor](https://cursor.sh) 完成，这是一个强大的 AI 驱动的代码编辑器。

## Todo List

 - [] 设立 @sesese.se 邮局
 - [] 添加除了 Pixiv 之外站点（如 X、Danbooru 等）的图片获取方式
 - [] 解决图片加载后导致的网页重排问题
 - [] 使用统一的组件来调用 index.astro 和 [order].astro 中重复的代码部分
 - [] 使用 ajax/pjax 或类似的技术来实现全站的无缝加载

## 开始使用

1. 克隆仓库
```bash
git clone https://github.com/yourusername/sesese-se.git
cd sesese-se
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 构建生产版本
```bash
npm run build
```

## 配置

1. 获取 Pixiv REFRESH_TOKEN：
   - 参考 [pixivpy](https://github.com/upbit/pixivpy)

2. 在你的 GitHub 仓库中设置以下 Secret：
   - `PIXIV_REFRESH_TOKEN`: 你的 Pixiv REFRESH_TOKEN

3. 添加图片：
   - 在 GitHub Actions 页面中选择 "Fetch Pixiv Artwork" 工作流
   - 点击 "Run workflow"
   - 输入要获取的 Pixiv 作品 ID
   - 点击 "Run workflow" 开始执行
   - 工作流会自动下载图片并更新网站内容

## 部署

本站使用 GitHub Actions 自动部署到 Vercel。每次推送代码到 main 分支时，都会自动触发部署。

## 许可证

MIT 