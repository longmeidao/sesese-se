# 色览架构决策

更新日期：2026-07-22

## 结论

默认采用：

1. Astro 静态生成；
2. Astro ClientRouter + View Transitions 做无刷新页面切换；
3. GitHub Actions 做采集与图片处理，动态 Worker 只负责快捷录入和调度；
4. Cloudflare R2 存图片，`media.sesese.se` 作为可替换的媒体源域名；
5. Cloudflare Workers Static Assets 托管静态站点；
6. Git 仓库只存代码和作品元数据，不存图片；
7. D1 暂不使用；OSS 只作最后灾备。

Cloudflare 并不是业务依赖。页面通过 `PUBLIC_MEDIA_ORIGIN` 访问图片，采集器的存储实现集中在一个类中；以后切换到 B2、S3 或 OSS，不需要改作品模型和展示组件。

## 为什么不是“图片一直提交到仓库”

Git 会为每次新增、删除或替换的二进制图片永久保留对象。当前仓库工作区只有约 1 MB 的公开静态资源，但 `.git` 已约 36 MB，主要来自早期反复提交的图片；随着藏品增长，克隆、CI checkout、历史清理和协作都会越来越慢。

GitHub 建议仓库理想情况下小于 1 GB，并明确建议把生成文件放在对象存储。普通 Git 对单文件 50 MiB 提示、100 MiB 阻止；Git LFS 虽有免费额度，但 GitHub Pages 不能使用 LFS，且 10 GB/月带宽并不适合公开图片站。

因此：

- Git 保存几十 KB 的 JSON 元数据，获得版本历史、审查和回滚能力；
- 对象存储保存图片字节，获得按对象读取、缓存策略和独立容量扩展；
- R2 的生命周期或离线备份承担图片备份职责，Git 不承担备份职责。

参考：[GitHub 大文件说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)、[Git LFS 说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)。

## 静态托管对比

| 方案 | 免费额度与约束 | 访问路径 | 结论 |
| --- | --- | --- | --- |
| Cloudflare Workers Static Assets | 静态资源请求免费且不限量；单文件 25 MiB；免费账户每个版本 20,000 个静态文件 | Cloudflare 全球边缘节点；普通页面不执行 Worker | **首选**。Cloudflare 已建议新静态项目使用 Workers Static Assets |
| Cloudflare Pages | 每月 500 次构建；20,000 文件；单文件 25 MiB | 同属 Cloudflare 边缘网络 | 可用，但新能力重点已转向 Workers；不再作为新项目首选 |
| GitHub Pages | 发布站点最大 1 GB；软性 100 GB/月带宽 | GitHub Pages CDN | 最简单的灾备托管；不适合图片本体，也缺少对象存储的一体化缓存控制 |
| Vercel Hobby | 100 GB Fast Data Transfer；100 次部署/日；限个人、非商业用途 | Vercel Edge Network | 性能可用，但用途条款和静态传输配额不如 Cloudflare 适合长期公开站点 |
| Netlify Free | 每月 300 credits；生产部署 15 credits/次、带宽 20 credits/GB、请求 2 credits/万次 | Netlify CDN | 小站可用，但部署、流量和请求共享额度，流量增长时更容易整站暂停 |

参考：[Workers Static Assets 费用](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[Workers 限额](https://developers.cloudflare.com/workers/platform/limits/)、[Pages 限额](https://developers.cloudflare.com/pages/platform/limits/)、[GitHub Pages 限额](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[Vercel Hobby](https://vercel.com/docs/plans/hobby)、[Netlify 定价](https://www.netlify.com/pricing/)。

### 速度说明

主站是纯静态 HTML/CSS/少量 JS，任何成熟 CDN 的首字节时间都不会成为主要瓶颈；图片体积、缓存命中和是否按屏幕尺寸下发才是更重要因素。采集器会预生成多档 WebP，浏览器使用 `srcset` 选择尺寸，R2 自定义域名启用边缘缓存和 Smart Tiered Cache。

免费服务都不能保证中国大陆内地网络的稳定低延迟。若主要访问者在中国大陆且需要确定性体验，通常需要备案域名与中国大陆节点；这时可把同一对象键同步到 OSS/COS，作为付费媒体镜像，通过 `PUBLIC_MEDIA_ORIGIN` 切换，而不是把 OSS 写死在代码中。

## 图片存储对比

| 方案 | 免费容量 | 免费流量/请求 | 结论 |
| --- | ---: | --- | --- |
| Cloudflare R2 Standard | 10 GB/月 | 公网流出免费；每月 100 万 Class A、1,000 万 Class B | **首选**。免费额度、流量和 Cloudflare 缓存组合最好 |
| Backblaze B2 | 前 10 GB 免费 | 免费流出约为平均存储量的 3 倍，超出后按量付费；事务大多免费 | 最佳跨厂商备份候选，也可在 R2 不合适时作为主存储 |
| GitHub LFS | 10 GB 存储、10 GB/月带宽 | 超额需付费，且 Pages 不能直接使用 | 适合协作大文件，不适合公开图片热链路 |
| Supabase Storage Free | 1 GB | 5 GB cached egress；免费项目闲置会暂停 | 容量偏小，且本项目不需要数据库/Auth，不值得引入整个平台 |
| OSS | 通常按存储、请求和公网流量计费 | 取决于账户与地域 | 仅作付费灾备或中国大陆媒体镜像 |

参考：[R2 定价](https://developers.cloudflare.com/r2/pricing/)、[R2 公共桶与自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)、[B2 定价](https://www.backblaze.com/cloud-storage/pricing)、[Supabase 定价](https://supabase.com/pricing)。

## 为什么暂不使用 D1/动态 Worker

作品元数据规模很小、更新频率低、读取远多于写入。提交 JSON 后静态生成有几个优势：

- 页面在边缘直接命中静态文件，不消耗 Worker/D1 配额；
- Git 历史天然记录内容变更和回滚；
- 没有数据库迁移、备份和运行时故障面；
- RSS、sitemap 和编号页在一次构建中保持一致。

当作品数达到数千、每次构建明显变慢，或需要搜索、用户收藏、管理后台时，再迁移到 D1。此时统一 `Artwork` 模型可以直接映射表结构，R2 对象键无需改变。

`/api/ingest` 是唯一的动态 Worker 路径。它验证共享链接和 webhook secret，再调用 GitHub workflow dispatch；抓取、Pillow 压缩、R2 上传和 Git 提交仍在 Actions 中完成。这样手机不保存 GitHub token，普通页面也不消耗 Worker 动态请求或 CPU 配额。部署工作流监听采集工作流成功完成事件，不依赖机器人提交再次触发 `push`，因此从快捷指令到静态站更新是闭环的。

## 为什么采集仍使用 GitHub Actions

采集属于低频、批处理、需要较多 CPU 和外网等待的任务。GitHub 公共仓库的标准托管 runner 免费，能够直接运行 Python/Pillow、使用仓库 Secrets，并在完成后原子提交元数据。Workers Free 的动态请求有 10ms CPU 限制，不适合解码和生成多档大图；把图片处理塞进访问链路也会增加超时与失败恢复难度。

这不意味着每次必须打开 GitHub 网页：`/api/ingest` 接受 Pixiv/X 分享链接并触发同一个工作流，macOS/iOS 快捷指令只是这个入口的客户端。以后若采集量大到 Actions 排队成为瓶颈，可以把相同的 adapter/metadata 协议搬到专门队列或容器任务，无需改前端。

参考：[GitHub Actions 计费](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)、[Workers 限额](https://developers.cloudflare.com/workers/platform/limits/)。

## 无刷新导航设计

首页和编号页的静态 HTML 都完整可访问；禁用 JavaScript时仍能普通跳转。启用 JavaScript 后：

- `ClientRouter` 拦截站内链接并预取下一页 HTML；
- View Transitions 只交叉淡入作品区域和说明卡；
- 页头持久化，页面背景由共享 CSS 保持；
- 浏览器前进/后退、焦点公告、减少动态效果偏好由 Astro 处理。

这实现了 PJAX 的体验，但不再维护一套自定义 DOM 替换、历史与脚本生命周期逻辑。

## 多来源数据模型

展示层只读取以下规范化字段：来源、原站 ID/URL、作者、发布时间、收录时间、标签、`display_image_index` 与媒体变体。任何来源都写入 `src/content/artworks/<source>-<id>.json`。

```text
来源适配器（Pixiv / X / Danbooru / 任意 URL）
  -> 统一 Artwork
  -> 选择 display_image_index（默认第 1 张）
  -> 只为该图片生成多尺寸 WebP
  -> 对象存储 media/<source>/<id>/<page>/...
  -> Astro 页面 / RSS / sitemap
```

Pixiv 适配器自动调用 API。X 首选免费的 FxTwitter 兼容接口，也可通过 `X_BEARER_TOKEN` 切到官方付费 API；两者都会提取正文、hashtag、稳定作者 ID 和图片。Danbooru 与其他网站首版使用通用直链入口。未来新增自动适配器时，只需要产生同一个 `FetchedArtwork`，无需修改存储、内容集合或页面。

多图来源不会在页面上形成轮播：一个站内作品固定展示原作的一张图。`display_image_index` 是原站的一基页码，缺省为 1；R2 和 JSON 只保存选中页，字段校验会确保它与 `media[].index` 一致。作者身份同样不依赖易变显示名，而以 `(source.type, author.id)` 为主键；清理后的 `author.name` 用于展示，原名保留为 `author.name_raw`。

X 官方 API 当前是按量付费，FxTwitter 则是开源、免费但无服务保证的兼容层。因此免费入口适合作为个人站默认方案，官方 token 是追求稳定时的显式选择，手工直链则是两者都失败时的兜底。

参考：[X API 定价](https://docs.x.com/x-api/getting-started/pricing)、[FxTwitter 项目](https://github.com/FixTweet/FxTwitter)。

## 迁移顺序

1. 创建 R2 Standard bucket `sesese-se-media`。
2. 将 `media.sesese.se` 绑定到 R2，关闭 `r2.dev` 公共开发地址，开启缓存与 Smart Tiered Cache。
3. 设置 GitHub Secrets 和 Variables。
4. 运行一次 `Migrate existing media to R2`，从 Pixiv 重抓现有作品、写入真实宽高和响应式变体。
5. 确认媒体域名可访问后，运行部署工作流。
6. 验证新站后再停用 Netlify；旧 OSS 不参与迁移。
