# 运维手册

## 一次性初始化

1. 在 Cloudflare 创建 R2 Standard bucket，建议命名 `sesese-se-media`。
2. 创建只允许该 bucket 读写的 R2 S3 API Token。
3. 为 bucket 连接自定义域名 `media.sesese.se`。
4. 在 Cloudflare Cache Rules 中为 `media.sesese.se/*` 启用缓存，并开启 Smart Tiered Cache。
5. 创建 Workers API Token，只授予部署 `sesese-se` Worker 所需权限。
6. 在 GitHub 添加 README 中列出的 Secrets 与 Variables；`X_BEARER_TOKEN` 不填即使用免费的 FxTwitter 兜底。
7. 为 Worker 添加 `GITHUB_TOKEN` 和 `INGEST_WEBHOOK_SECRET` 两个加密 Secret。
8. 运行 `Migrate existing media to R2`。
9. 运行 `Deploy to Cloudflare Workers`。
10. 在 Workers 设置中连接 `sesese.se` 和 `www.sesese.se` 自定义域名。

## 添加 Pixiv 作品

运行 `Ingest artwork`：

- `source`: `pixiv`
- `artwork_id`: Pixiv 数字 ID
- `display_image`: 可选，原作中要展示的图片页码，从 1 开始，默认 1

工作流会自动读取标题、作者和标签，只下载选中的一张图片。

## 添加 X 作品

运行 `Ingest artwork`：

- `source`: `x`
- `artwork_id`: 完整状态链接，例如 `https://x.com/DUTJu719Nd8nTHn/status/2079570838794514878`
- `display_image`: 可选，状态中要展示的第几张图片，默认 1

未配置 `X_BEARER_TOKEN` 时，采集器调用开源 FxTwitter 的公共服务，通常可以免费取得正文、hashtag、作者稳定 ID、当前显示名和原图，但它是无 SLA 的第三方兼容层，X 改动后可能临时失效。配置 token 后走 X 官方 API；官方接口按读取资源计费。自动抓取失败时仍可填 `image_urls`、标题和作者，转入通用直链流程。

作者去重始终使用来源站的稳定用户 ID，而不是显示名。显示名原文保存在 `name_raw`；规范名只剥离明确的临时活动、摊位或约稿后缀，避免作者改名或添加活动信息后产生重复作者。

## 添加任意网站作品

运行 `Ingest artwork`，把 `source` 设为 `danbooru` 或 `other`，并填写：

- 稳定的 `artwork_id` 或 slug；
- 原页面 URL；
- 一行一个的图片直链；
- 标题、作者名与作者页面；
- 可选描述和标签。

通用入口不抓取页面 HTML，避免把站点反爬规则和易变 DOM 耦合进核心采集器。高频使用某来源后，再为它增加专用 API 适配器。

## 从 macOS / iOS 快捷指令添加

动态 Worker 只是一个很薄的受保护入口：它不抓图、不处理图片，只校验链接并触发 GitHub Actions。GitHub token 留在 Worker 中，手机和电脑只保存可随时轮换的 webhook secret。

在“快捷指令”中新建一个接收分享表单中“URL”的指令：

1. 添加“从输入中获取 URL”；
2. 可选添加“询问输入”，问题设为“第几张？”，默认值为 `1`；
3. 添加“获取 URL 内容”，URL 为 `https://sesese.se/api/ingest`，方法为 `POST`；
4. 请求头添加 `Authorization: Bearer <INGEST_WEBHOOK_SECRET>`；
5. 请求正文选择 JSON，加入 `url: 快捷指令输入` 和 `display_image: 第 2 步的数字`；
6. 添加“显示结果”。

如果不询问页码，省略 `display_image` 即默认第 1 张。之后在 Pixiv 或 X 的分享菜单中选择该快捷指令即可；响应为 `202 accepted` 只表示工作流已排队，最终结果在仓库 Actions 页面查看。

也可以从 macOS 终端直接提交：

```bash
curl --request POST https://sesese.se/api/ingest \
  --header 'Authorization: Bearer YOUR_WEBHOOK_SECRET' \
  --header 'Content-Type: application/json' \
  --data '{"url":"https://x.com/user/status/123","display_image":2}'
```

## 更新与删除

- 更新元数据：直接修改对应 JSON。
- 重新抓图：运行采集工作流并打开 `force`；由于对象 URL 可能已缓存，生产环境应在上传后清除对应路径缓存。
- 更换多图作品的展示页：重新运行采集工作流并填写新的 `display_image`；元数据中只保留新选中的页。
- 删除作品：删除 JSON 后部署；R2 对象先保留 30 天观察，再手动删除。

## 备份

- GitHub 保存代码和所有元数据历史。
- 每月把 R2 bucket 增量同步到 Backblaze B2 或本地冷存储。
- 不把备份图片重新提交到 Git。
- OSS 只在需要中国大陆付费镜像或其他存储都不可用时启用。

## 容量预警

建议在 R2 达到 8 GB 时检查：

1. 是否保留了不必要的超大原始变体；
2. 是否存在孤立对象；
3. 是否需要把冷门原图移入 B2，只在 R2 保留展示尺寸；
4. 是否需要升级付费存储。R2 超出免费 10 GB 后仍是按量计费，不应假设服务会自动阻止费用。
