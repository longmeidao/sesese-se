# 运维手册

## 一次性初始化

1. 在 Cloudflare 创建 R2 Standard bucket，建议命名 `sesese-se-media`。
2. 创建只允许该 bucket 读写的 R2 S3 API Token。
3. 为 bucket 连接自定义域名 `media.sesese.se`。
4. 在 Cloudflare Cache Rules 中为 `media.sesese.se/*` 启用缓存，并开启 Smart Tiered Cache。
5. 创建 Workers API Token，只授予部署 `sesese-se` Worker 所需权限。
6. 在 GitHub 添加 README 中列出的 Secrets 与 Variables；`X_BEARER_TOKEN` 不填即使用免费的 FxTwitter 兜底。
7. 在 Cloudflare 的 `sesese-se` Worker 中添加 `GITHUB_TOKEN` 加密 Secret。它是 Worker 运行时变量，不是 GitHub Actions Secret，也不要只设置在 Preview 环境。
8. 运行 `Migrate existing media to R2`。该工作流会强制重建已有响应式图片，以便压缩参数升级后真正替换旧文件。
9. 运行 `Deploy to Cloudflare Workers`。
10. 在 Workers 设置中连接 `sesese.se` 和 `www.sesese.se` 自定义域名。
11. 建立后台的 Cloudflare Access 应用，并把 `ACCESS_TEAM_DOMAIN` 与 `ACCESS_AUD` 填进 `wrangler.jsonc`，见[身份验证：Cloudflare Access](#身份验证cloudflare-access)。没做这一步时管理台会失败关闭。

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

## 从管理台添加

日常收录都从 `https://sesese.se/admin/` 的「收录新作品」进行，它调用 `/api/admin/ingest`，身份由 Cloudflare Access 验证。Worker 只是一个很薄的入口：不抓图、不处理图片，只校验链接并触发 GitHub Actions，GitHub token 始终留在 Worker 里。响应 `202 accepted` 只表示工作流已排队，进度看管理台的「最近采集」或仓库 Actions 页。

> 曾经还有一个 `/api/ingest`，用共享密钥供 iOS/macOS 快捷指令调用。实际没有用起来，已经连同 `INGEST_WEBHOOK_SECRET` 一并删除 —— 少一个长期有效的明文凭据，就少一条要看管的路。要恢复的话，`dispatchIngest()` 还在，加一条不走 Access 的路由即可。

## 更新与删除

- 管理入口：部署后访问 `https://sesese.se/admin/`，由 Cloudflare Access 验证身份（配置见下节）。页面本身不再保存任何密钥；验证通过前，不会读取藏品资料，也不会显示管理功能。「退出管理」会跳到 `/cdn-cgi/access/logout` 结束 Access 会话。
- 更新元数据：在管理台填写需要手动修改的内容；空白内容也可作为明确的修改结果。勾选“使用原站内容”会删除对应的手动修改。重新抓取只更新来源数据，不会覆盖手动修改。保存会立即提交到 GitHub，并自动触发 `Deploy to Cloudflare Workers`，通常约半分钟完成；管理台会一直显示发布状态，直到上线或失败。
- 重新抓图：运行采集工作流并打开 `force`；由于对象 URL 可能已缓存，生产环境应在上传后清除对应路径缓存。
- 更换多图作品的展示页：重新运行采集工作流并填写新的 `display_image`；元数据中只保留新选中的页。
- 隐藏作品：状态改为 `hidden`，公开页面不再生成该作品，但可以随时恢复。
- 删除作品：管理台先将状态改为 `deleted`；公开页面立即移除，R2 对象和元数据保留 30 天。每周一运行的 `Cleanup deleted media` 会删除过期 R2 变体和作品 JSON，但不会移除 `src/content/artwork-sequences.json` 中的登记，因此永久 `sequence` 不复用。

## 管理台部署后设置

### 身份验证：Cloudflare Access

浏览器后台（`/admin/` 与 `/api/admin/*`）的登录由 Cloudflare Access 负责，页面上不再有访问密钥输入框。

1. 在 Cloudflare Zero Trust → Access → Applications 创建 **Self-hosted** 应用；
2. Application domain 填 `sesese.se`，并添加两个 path：`admin` 与 `api/admin`；
3. Policy 选 Allow，条件用 Emails，只填写自己的邮箱；登录方式用 One-time PIN 即可，不必接第三方 IdP；
4. 回到应用 Overview，复制 **Application Audience (AUD) Tag**；
5. 把 AUD 和团队域名填进 `wrangler.jsonc` 的 `vars`，然后重新部署：

```jsonc
"ACCESS_TEAM_DOMAIN": "https://<你的团队名>.cloudflareaccess.com",
"ACCESS_AUD": "<刚复制的 AUD>"
```

这两个值保持 `REPLACE-ME` 时，Worker 会拒绝所有 `/api/admin/*` 请求并返回 503，管理页会直接显示「还没有配置 ACCESS_TEAM_DOMAIN 和 ACCESS_AUD」——失败关闭，不会误放行。

> Worker 自己会再验一遍 JWT 签名、`aud` 和 `exp`。只靠 Access 在边缘拦截是不够的：
> Access 绑在 zone（`sesese.se`）上，绕过自定义域名直接打 `*.workers.dev` 就没人管了。
>
> 同理，**登录流程在 `*.workers.dev` 上测不出来**——那边拿不到 Access Cookie，
> `/api/admin/session` 永远是 `{"authenticated":false}`。在那里只能验证「未登录时是否失败关闭」。

### 日志

`wrangler.jsonc` 里 `observability.enabled` 为 true、采样率 1（全量）。Worker 只处理 `/api/*`，量很小，不必抽样。日志在 Cloudflare Dashboard → Workers & Pages → `sesese-se` → Logs 里回溯，也可以 `npx wrangler tail` 实时看。

关掉它的代价是运行时日志**根本不留存**，事后完全无法回溯——出过一次这样的情况，所以不要为省配额关掉。团队域名或 AUD 填错时，Worker 会打 `access_not_configured` 或 `access_certs_failed`，就靠这里看。

### Secrets

Worker 只需要一个 Secret：`GITHUB_TOKEN`，用于读写仓库和启动 Actions，需要目标仓库的 Actions 写入和 Contents 读写权限。Access 不需要 Secret —— `ACCESS_AUD` 只是应用标识，真正的凭据是 Access 每次签发的短期 JWT，Worker 从不持有长期密钥。

如果管理页提示缺少 Secret，请打开 Cloudflare Dashboard → Workers & Pages → `sesese-se` → Settings → Variables and Secrets，确认 Production 环境中存在 `GITHUB_TOKEN`，并且类型必须选择 **Secret**，不能选择普通文本变量。也可以在已经设置好 `CLOUDFLARE_API_TOKEN` 的终端中执行：

```bash
npx wrangler secret put GITHUB_TOKEN
```

修改 Secret 后不必重新构建网站；刷新管理页即可。接口会明确指出缺少哪一个变量。

`wrangler.jsonc` 已把它声明为必需 Secret：缺少时后续部署会直接失败，不再发布一个无法工作的新版本。配置同时启用了 `keep_vars`，避免仓库部署覆盖临时保存在 Cloudflare 控制台中的普通变量；敏感值仍必须使用 Secret。

### 回滚

Access 把自己挡在外面时，不影响内容本身：元数据是 git 里的 JSON，直接 commit 就能改。真要退回密钥登录，得 `git revert` 到引入 Access 之前，并重新 `wrangler secret put INGEST_WEBHOOK_SECRET`（原来的已删除，需要生成新值）。

本地 `astro dev` 只预览静态管理界面，不运行 Worker API；需要联调接口时先执行 `npm run build`，再使用 `wrangler dev`。`astro dev` 下管理页会显示「无法确认登录状态（404）」，属正常现象。

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
