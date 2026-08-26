# sesese-se 项目约定

## 开始工作前

- 先比对当前 checkout、Git 根目录、remote、提交和工作树状态，不要在
  旧副本或镜像目录中修改真实仓库。
- 通过 `README.md`、`docs/architecture.md`、`docs/operations.md` 和已忽略的
  `history/` 恢复上下文；项目约束以本文件为唯一代理规则源。
- Node 与 npm 约束以 `package.json` 为准；只使用 npm，不混用 pnpm/yarn。

## 架构原则

- 代码和紧凑元数据放 Git，大体积媒体放 R2/对象存储。
- 生产环境用自有域名 `media.sesese.se`，不要用 `r2.dev`。
- Astro 产出静态站点，Cloudflare Worker 只处理 `/api/*`；不要引入 D1
  或其他数据库替代 Git 中的 JSON 内容源。
- CDN 存图仅作最后备选；各服务商免费额度是硬约束。

## Wrangler 与部署

- `secrets.required` 声明必需的 Cloudflare secrets；缺失必须在部署前失败。
- `keep_vars` 只防止普通变量被覆盖，不等同于 secrets 保护。
- 自定义域名在 `wrangler.jsonc` 的 `routes` 与 `custom_domain: true` 中
  管理；只在控制台配置会让 `workers.dev` 和真实域名跑在不同版本。
- 判断是否已部署到生产时，比对目标自定义域名，不要只看临时 host。
- Worker 代码部署和 Workers Routes 更新是两套权限；发布 token 需同时
  具有 `Worker Scripts Edit` 和 `Zone Workers Routes Edit`。后者缺失时会在
  `/zones/.../workers/routes` 报 `Authentication error [code: 10000]`；不要
  因此反复改代码。

## Git 与后台

- 后台采集任务可能产生远程 commit。push 前先 fetch/rebase，绝不 force-push
  覆盖远程。
- 后台状态必须区分 GitHub commit、Actions 部署中、已上线和失败；
  保存成功不等于已上线。
- 后台保持页面整体宽度一致，只在面板内部分配空间；使用紧凑、对齐的
  监控式层级和中性标准按钮，警示色只用于危险操作，移动端指标列堆叠。

## 修改与验证

- 用户要求彻底重构时，产品目的不变，但必须从访问速度、存储空间、
  更新便利度、维护性、架构/CDN 备选和免费额度边界逐项比较；
  审计或部分迁移不算完成。
- 完整自动验证运行 `npm run verify`。部署相关修改另外运行 Wrangler
  dry-run，并执行 `git diff --check`。
- 公开说明必须分开报告代码、提交、部署、线上行为和浏览器验收状态。
- 提交前检查未跟踪文件和敏感信息；不要提交 token、Cookie、私钥或
  未经核实的个人数据。
