# sesese-se

Pixiv 图片收集与展示站。架构：**Cloudflare Workers Static Assets + R2**（从 Astro/Netlify + OSS 迁移而来）。

> 本文件从 Codex 历史记忆迁移并人工筛选（2026-07）。已剔除 commit SHA、Actions run ID、
> 一次性排障记录等时效性内容，保留可复用的约定与结论。
> 历史会话存档在 `history/`（已加入 .gitignore）。

## 架构原则

- **代码和紧凑元数据放 Git，大体积媒体放 R2/对象存储**
- 生产环境用自有域名 `media.sesese.se`，**不要用 `r2.dev`**
- CDN 存图仅作最后备选方案
- 各服务商免费额度是硬约束，选型时优先考虑

旧流程（已废弃，供对照）：
`fetch_pixiv.py` → GitHub Actions → `src/content/pixiv/*.json` + 临时图片
→ `batch-upload-to-oss.js` WebP 上传 → Astro/Netlify

## Wrangler / 部署

- `secrets.required` 声明必需的 Cloudflare secrets —— **缺失必须在部署前失败**
- `keep_vars` 只防止普通变量被覆盖，不等同于 secrets 保护
- **自定义域名在 Wrangler 源码里管理**（`routes` + `custom_domain: true`）。
  只在控制台配置会导致 workers.dev 和真实域名跑在不同版本上
- 判断是否真的部署到生产，**对比目标自定义域名**，不要看临时 host 就下结论

### Cloudflare token 权限

部署 Worker 代码和更新 Workers Routes 是**两套权限**。token 需要同时具备：

- `Worker Scripts Edit`
- `Zone Workers Routes Edit`

缺后者会在更新 `/zones/.../workers/routes` 时报
`Authentication error [code: 10000]`。这时**换 token 重跑**，不要反复改代码或用旧 token 重试。

## Git

后台采集任务可能产生远程 commit。push 前先 fetch/rebase，**绝不 force-push 覆盖**。

## Admin UI

- 状态必须区分四态：**GitHub commit / Actions 部署中 / 已上线 / 失败**。
  保存成功 ≠ 已上线
- 保持页面整体宽度一致，只在面板内部重新分配空间
- 风格：紧凑、对齐的监控式层级，中性标准按钮，警示色只用于危险操作
- 移动端指标列堆叠

## 工作方式

- 用户说"彻底重构"时，产品目的不变，但要从访问速度、存储空间、更新便利度、
  维护性、架构/CDN 备选、免费额度边界逐项比较。**审计或部分迁移不算完成**
- 动可能重复的 checkout 前，先比对 checkout、remote、remote SHA 和仓库改名/上游状态
  （曾有 `~/Desktop/lmd.gg/sesese-se` 与 `~/Documents/sesese-se` 并存的情况）
- 验证链路：`npm run build` → Wrangler dry-run → `git diff --check`
