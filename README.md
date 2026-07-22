# 色览

[sesese.se](https://sesese.se) 是一个展示笔者心水之画作的网站。项目从 Pixiv 开始，并通过统一的作品模型支持 X、Danbooru 或任意网页图片。

## 现在的架构

- Astro 生成纯静态页面；Astro ClientRouter 负责无刷新切换和 View Transitions。
- 图片存放在对象存储中，默认方案是 Cloudflare R2；仓库只提交 JSON 元数据。
- GitHub Actions 抓取、压缩、上传图片并提交元数据。
- Cloudflare Workers Static Assets 分发静态构建产物；仅 `/api/ingest` 调用动态 Worker。
- OSS 不在默认链路中，只保留为付费灾备或中国大陆加速的最后选项。

完整取舍见 [架构说明](docs/architecture.md)，日常操作见 [运维手册](docs/operations.md)。

## 本地开发

```bash
npm ci
npm run dev
```

构建生产版本：

```bash
npm run build
```

本地页面默认从 `https://media.sesese.se` 读取图片。需要切换对象存储域名时，复制 `.env.example` 为 `.env` 并修改 `PUBLIC_MEDIA_ORIGIN`。

## 添加作品

在 GitHub Actions 中运行 **Ingest artwork**：

- Pixiv：选择 `pixiv`，输入作品 ID。
- X：选择 `x`，直接粘贴完整状态链接。默认通过免费的 FxTwitter 尝试取得正文、标签、稳定作者 ID 和图片；配置 `X_BEARER_TOKEN` 后改用 X 官方付费 API。
- Danbooru 或其他网站：填写原页面、直接图片 URL、标题和作者。
- 多图作品用 `display_image` 指定原作中的第几张（一基）；不填时只抓取并展示第 1 张。

工作流只下载选中的一张，按最长边 640/960/1600/2400px 生成 WebP、上传对象存储，并在 `src/content/artworks` 写入统一元数据。展示层不依赖来源站点；新增自动适配器时，只需扩展 `scripts/ingest.py`。

部署 `/api/ingest` 后，macOS 与 iOS 可通过系统“快捷指令”的分享表单直接提交 Pixiv/X 链接，无需进入仓库。配置步骤见 [运维手册](docs/operations.md#从-macos--ios-快捷指令添加)。

## 所需配置

GitHub Secrets：

- `PIXIV_REFRESH_TOKEN`
- `X_BEARER_TOKEN`（可选；官方 API 会计费）
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_API_TOKEN`

Cloudflare Worker Secrets：

- `GITHUB_TOKEN`（仅限本仓库，Actions read/write）
- `INGEST_WEBHOOK_SECRET`（自行生成的长随机值）

GitHub Variables：

- `R2_BUCKET`，建议为 `sesese-se-media`
- `PUBLIC_MEDIA_ORIGIN`，建议为 `https://media.sesese.se`

## 许可证

代码采用 MIT 许可证。展示图片的权利归原作者或相应权利人所有。
