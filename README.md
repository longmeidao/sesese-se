# Pixiv Artwork Fetcher

这是一个 GitHub Action，用于自动获取 Pixiv 上的图片作品及其元数据信息。

## 功能特点

- 支持获取单页和多页作品
- 保存完整的元数据信息（包括作者、标签、创建日期等）
- 自动下载原始图片
- 支持通过 GitHub Actions 手动触发

## 使用方法

1. 获取 Pixiv REFRESH_TOKEN：
   - 登录 Pixiv 网页版
   - 打开浏览器开发者工具（F12）
   - 在 Network 标签页中找到任意 API 请求
   - 在请求头中找到 `x-client-hash` 和 `x-client-time` 参数
   - 使用这些参数构造 REFRESH_TOKEN

2. 在你的 GitHub 仓库中设置以下 Secret：
   - `PIXIV_REFRESH_TOKEN`: 你的 Pixiv REFRESH_TOKEN

3. 在 GitHub Actions 页面中：
   - 选择 "Fetch Pixiv Artwork" 工作流
   - 点击 "Run workflow"
   - 输入要获取的 Pixiv 作品 ID
   - 点击 "Run workflow" 开始执行

## 输出

工作流执行完成后，会在仓库中创建以下文件结构：

```
artworks/
  └── {artwork_id}/
      ├── metadata.json    # 包含作品的元数据信息
      ├── page_1.jpg       # 第一页图片
      ├── page_2.jpg       # 第二页图片（如果是多页作品）
      └── ...
```

## 注意事项

- 请确保你有权限访问目标作品
- 建议遵守 Pixiv 的使用条款和版权规定
- 不要频繁触发工作流，以免对 Pixiv 服务器造成压力
- REFRESH_TOKEN 有效期较长，但也会过期，过期后需要重新获取 