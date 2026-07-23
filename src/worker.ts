interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GITHUB_TOKEN: string;
  INGEST_WEBHOOK_SECRET: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_REF?: string;
}

interface IngestRequest {
  url: string;
  display_image?: number;
  title?: string;
  description?: string;
  tags?: string;
  author_name?: string;
  author_url?: string;
  image_urls?: string;
  force?: boolean;
}

interface GitHubContent {
  sha: string;
  content: string;
  encoding: 'base64';
}

interface GitHubDirectoryEntry {
  name: string;
  path: string;
  type: string;
}

type ArtworkStatus = 'active' | 'hidden' | 'deleted';

class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function requireAdmin(request: Request, env: Env): void {
  if (!env.INGEST_WEBHOOK_SECRET) {
    throw new ApiError('Cloudflare Worker 缺少 INGEST_WEBHOOK_SECRET', 503);
  }

  const authorization = request.headers.get('authorization') ?? '';
  const suppliedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!safeEqual(suppliedSecret, env.INGEST_WEBHOOK_SECRET)) {
    throw new ApiError('访问密钥不正确', 401);
  }
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new ApiError('请求内容格式不正确');
  }
}

function repository(env: Env) {
  return {
    owner: env.GITHUB_OWNER || 'longmeidao',
    repo: env.GITHUB_REPO || 'sesese-se',
    ref: env.GITHUB_REF || 'main',
  };
}

function githubHeaders(env: Env): HeadersInit {
  if (!env.GITHUB_TOKEN) {
    throw new ApiError('Cloudflare Worker 缺少 GITHUB_TOKEN', 503);
  }

  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'content-type': 'application/json',
    'user-agent': 'sesese-se-admin-worker',
    'x-github-api-version': '2022-11-28',
  };
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function validateArtworkId(value: string): string {
  if (!/^(pixiv|x|danbooru|other)-[a-zA-Z0-9._-]{1,180}$/.test(value)) {
    throw new ApiError('藏品编号格式不正确');
  }
  return value;
}

async function githubContent(id: string, env: Env): Promise<{ file: GitHubContent; artwork: Record<string, unknown> }> {
  const safeId = validateArtworkId(id);
  const { owner, repo, ref } = repository(env);
  const path = `src/content/artworks/${safeId}.json`;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(env) },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new ApiError('无法从 GitHub 读取藏品资料', response.status === 404 ? 404 : 502, detail);
  }

  const file = await response.json() as GitHubContent;
  if (file.encoding !== 'base64' || !file.content || !file.sha) {
    throw new ApiError('GitHub 返回了无法识别的文件内容', 502);
  }

  let artwork: Record<string, unknown>;
  try {
    artwork = JSON.parse(decodeBase64(file.content)) as Record<string, unknown>;
  } catch {
    throw new ApiError('藏品资料不是有效的 JSON', 502);
  }
  if (artwork.schema_version !== 2 || artwork.id !== safeId) {
    throw new ApiError('藏品资料与请求的编号不一致', 409);
  }

  return { file, artwork };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textOnly(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function adminArtwork(artwork: Record<string, unknown>) {
  const id = validateArtworkId(String(artwork.id ?? ''));
  const source = isRecord(artwork.source) ? artwork.source : {};
  const author = isRecord(artwork.author) ? artwork.author : {};
  const overrides = isRecord(artwork.overrides) ? artwork.overrides : {};
  const displayImageIndex = Number(artwork.display_image_index ?? 1);
  const mediaItems = Array.isArray(artwork.media) ? artwork.media.filter(isRecord) : [];
  const selectedMedia = mediaItems.find((item) => Number(item.index) === displayImageIndex) ?? mediaItems[0];
  if (!selectedMedia) throw new ApiError(`藏品 ${id} 没有可用的图片资料`, 502);

  const variants = Array.isArray(selectedMedia.variants)
    ? selectedMedia.variants.filter(isRecord)
    : [];
  const preferred = variants.filter((variant) => variant.format === 'webp');
  const candidates = preferred.length > 0 ? preferred : variants;
  const variant = [...candidates].sort((left, right) => Number(left.width ?? 0) - Number(right.width ?? 0)).at(-1);
  if (!variant || typeof variant.key !== 'string') {
    throw new ApiError(`藏品 ${id} 没有可用的图片地址`, 502);
  }

  const sourceTitle = typeof artwork.title === 'string' ? artwork.title : id;
  const sourceDescription = textOnly(artwork.description);
  const sourceTags = stringList(artwork.tags);
  const sourceAuthorName = typeof author.name === 'string' ? author.name : '';
  const overrideTitle = typeof overrides.title === 'string' ? overrides.title : undefined;
  const overrideDescription = typeof overrides.description === 'string' ? overrides.description : undefined;
  const overrideTags = Array.isArray(overrides.tags) ? stringList(overrides.tags) : undefined;
  const overrideAuthorName = typeof overrides.author_name === 'string' ? overrides.author_name : undefined;
  const statusValue = String(artwork.status ?? 'active');
  const status: ArtworkStatus = ['active', 'hidden', 'deleted'].includes(statusValue)
    ? statusValue as ArtworkStatus
    : 'active';

  return {
    id,
    sequence: Number(artwork.sequence ?? 0),
    status,
    deleted_at: typeof artwork.deleted_at === 'string' ? artwork.deleted_at : undefined,
    source_type: typeof source.type === 'string' ? source.type : 'other',
    source_url: typeof source.url === 'string' ? source.url : '',
    display_image_index: displayImageIndex,
    image: `https://media.sesese.se/${variant.key.replace(/^\//, '')}`,
    source: {
      title: sourceTitle,
      description: sourceDescription,
      tags: sourceTags,
      author_name: sourceAuthorName,
    },
    overrides: {
      ...(overrideTitle !== undefined ? { title: overrideTitle } : {}),
      ...(overrideDescription !== undefined ? { description: overrideDescription } : {}),
      ...(overrideTags !== undefined ? { tags: overrideTags } : {}),
      ...(overrideAuthorName !== undefined ? { author_name: overrideAuthorName } : {}),
    },
    effective: {
      title: overrideTitle ?? sourceTitle,
      description: overrideDescription ?? sourceDescription,
      tags: overrideTags ?? sourceTags,
      author_name: overrideAuthorName ?? sourceAuthorName,
    },
  };
}

async function listAdminArtworks(env: Env): Promise<Response> {
  const { owner, repo, ref } = repository(env);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/src/content/artworks?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(env) },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new ApiError('无法从 GitHub 读取藏品目录', 502, detail);
  }

  const entries = await response.json() as GitHubDirectoryEntry[];
  if (!Array.isArray(entries)) throw new ApiError('GitHub 返回了无法识别的藏品目录', 502);
  const ids = entries
    .filter((entry) => entry.type === 'file' && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -5))
    .filter((id) => /^(pixiv|x|danbooru|other)-/.test(id));

  const artworks: ReturnType<typeof adminArtwork>[] = [];
  for (let index = 0; index < ids.length; index += 5) {
    const batch = await Promise.all(
      ids.slice(index, index + 5).map(async (id) => adminArtwork((await githubContent(id, env)).artwork)),
    );
    artworks.push(...batch);
  }

  artworks.sort((left, right) => right.sequence - left.sequence);
  return json({ artworks });
}

async function commitArtwork(
  id: string,
  file: GitHubContent,
  artwork: Record<string, unknown>,
  message: string,
  env: Env,
): Promise<{ commitSha?: string }> {
  const { owner, repo, ref } = repository(env);
  const path = `src/content/artworks/${validateArtworkId(id)}.json`;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: githubHeaders(env),
    body: JSON.stringify({
      message,
      branch: ref,
      sha: file.sha,
      content: encodeBase64(`${JSON.stringify(artwork, null, 2)}\n`),
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    if (response.status === 409) {
      throw new ApiError('保存期间资料已被其他任务更新，请刷新后重试', 409, detail);
    }
    throw new ApiError('无法把修改保存到 GitHub', 502, detail);
  }

  const result = await response.json() as { commit?: { sha?: string } };
  return { commitSha: result.commit?.sha };
}

function classifySource(input: string): { source: 'pixiv' | 'x' | 'other'; artworkId: string; sourceUrl: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError('url 必须是完整的 http(s) 链接');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ApiError('只接受 http(s) 链接');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const pixivMatch = url.pathname.match(/^\/artworks\/(\d+)/);
  if (host === 'pixiv.net' && pixivMatch) {
    return {
      source: 'pixiv',
      artworkId: pixivMatch[1],
      sourceUrl: `https://www.pixiv.net/artworks/${pixivMatch[1]}`,
    };
  }

  const xMatch = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
  if (['x.com', 'twitter.com', 'mobile.twitter.com'].includes(host) && xMatch) {
    return {
      source: 'x',
      artworkId: `https://x.com/${xMatch[1]}/status/${xMatch[2]}`,
      sourceUrl: `https://x.com/${xMatch[1]}/status/${xMatch[2]}`,
    };
  }

  return {
    source: 'other',
    artworkId: `${host}-${crypto.randomUUID().slice(0, 8)}`,
    sourceUrl: url.toString(),
  };
}

function validateIngest(input: IngestRequest): {
  parsed: ReturnType<typeof classifySource>;
  displayImage: number;
} {
  if (typeof input.url !== 'string' || input.url.length > 2048) {
    throw new ApiError('请填写不超过 2048 个字符的作品链接');
  }

  const displayImage = input.display_image ?? 1;
  if (!Number.isInteger(displayImage) || displayImage < 1 || displayImage > 100) {
    throw new ApiError('展示页码必须是 1 到 100 之间的整数');
  }

  const parsed = classifySource(input.url);
  if (parsed.source === 'other' && (!input.image_urls || !input.title || !input.author_name)) {
    throw new ApiError('任意网站目前还需要 image_urls、title 和 author_name；Pixiv 与 X 只需分享作品链接');
  }

  return { parsed, displayImage };
}

async function dispatchIngest(input: IngestRequest, env: Env): Promise<Response> {
  const { parsed, displayImage } = validateIngest(input);
  const { owner, repo, ref } = repository(env);
  const workflowUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/ingest-artwork.yml/dispatches`;
  const response = await fetch(workflowUrl, {
    method: 'POST',
    headers: githubHeaders(env),
    body: JSON.stringify({
      ref,
      inputs: {
        source: parsed.source,
        artwork_id: parsed.artworkId,
        display_image: String(displayImage),
        source_url: parsed.sourceUrl,
        image_urls: input.image_urls ?? '',
        title: input.title ?? '',
        description: input.description ?? '',
        tags: input.tags ?? '',
        author_name: input.author_name ?? '',
        author_url: input.author_url ?? '',
        force: input.force ? 'true' : 'false',
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new ApiError('无法启动 GitHub 采集任务', 502, { status: response.status, detail });
  }

  return json({
    accepted: true,
    source: parsed.source,
    artwork_id: parsed.artworkId,
    display_image: displayImage,
    actions_url: `https://github.com/${owner}/${repo}/actions/workflows/ingest-artwork.yml`,
  }, 202);
}

function sanitizeString(value: unknown, label: string, maximum: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new ApiError(`${label} 的内容格式不正确`);
  if (value.length > maximum) throw new ApiError(`${label} 的内容过长`);
  return value;
}

function sanitizeTags(value: unknown): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 50) throw new ApiError('标签不能超过 50 个');
  const tags = value.map((item) => {
    if (typeof item !== 'string') throw new ApiError('标签内容格式不正确');
    const tag = item.trim().replace(/^#/, '');
    if (!tag || tag.length > 100) throw new ApiError('每个标签应为 1 到 100 个字符');
    return tag;
  });
  return [...new Set(tags)];
}

async function updateArtwork(request: Request, id: string, env: Env): Promise<Response> {
  const input = await readJson<{
    overrides?: {
      title?: string | null;
      description?: string | null;
      tags?: string[] | null;
      author_name?: string | null;
    };
    status?: ArtworkStatus;
  }>(request);
  if (!input.overrides && !input.status) throw new ApiError('没有需要保存的修改');
  if (
    input.overrides
    && (typeof input.overrides !== 'object' || Array.isArray(input.overrides))
  ) {
    throw new ApiError('手动修改的内容格式不正确');
  }

  const { file, artwork } = await githubContent(id, env);
  const current = (
    typeof artwork.overrides === 'object' && artwork.overrides !== null && !Array.isArray(artwork.overrides)
      ? { ...artwork.overrides as Record<string, unknown> }
      : {}
  );

  if (input.overrides) {
    const allowed = ['title', 'description', 'tags', 'author_name'] as const;
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(input.overrides, key)) continue;
      const value = key === 'tags'
        ? sanitizeTags(input.overrides[key])
        : sanitizeString(input.overrides[key], key, key === 'description' ? 10_000 : 300);
      if (value === null) delete current[key];
      else current[key] = value;
    }
    if (Object.keys(current).length > 0) artwork.overrides = current;
    else delete artwork.overrides;
  }

  if (input.status) {
    if (!['active', 'hidden', 'deleted'].includes(input.status)) throw new ApiError('藏品状态不正确');
    artwork.status = input.status;
    if (input.status === 'deleted') artwork.deleted_at = new Date().toISOString();
    else delete artwork.deleted_at;
  }

  const action = input.status ? `set ${id} ${input.status}` : `edit ${id}`;
  const committed = await commitArtwork(id, file, artwork, `content: ${action}`, env);
  return json({
    updated: true,
    id,
    status: artwork.status ?? 'active',
    commit_sha: committed.commitSha,
    deployment_pending: true,
  });
}

async function reingestArtwork(request: Request, env: Env): Promise<Response> {
  const input = await readJson<{ id?: string; display_image?: number }>(request);
  if (!input.id) throw new ApiError('缺少藏品编号');
  const { artwork } = await githubContent(input.id, env);
  const source = artwork.source as { type?: string; url?: string } | undefined;
  if (!source?.url || !['pixiv', 'x'].includes(source.type ?? '')) {
    throw new ApiError('目前只有 Pixiv 和 X 作品可以自动重新抓取');
  }

  return dispatchIngest({
    url: source.url,
    display_image: input.display_image ?? Number(artwork.display_image_index ?? 1),
    force: true,
  }, env);
}

async function recentRuns(env: Env): Promise<Response> {
  const { owner, repo } = repository(env);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/ingest-artwork.yml/runs?per_page=8`,
    { headers: githubHeaders(env) },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new ApiError('无法读取最近的采集记录', 502, detail);
  }

  const result = await response.json() as {
    workflow_runs?: Array<{
      id: number;
      status: string;
      conclusion: string | null;
      event: string;
      display_title: string;
      html_url: string;
      created_at: string;
      updated_at: string;
    }>;
  };
  return json({
    runs: (result.workflow_runs ?? []).map((run) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      event: run.event,
      title: run.display_title,
      url: run.html_url,
      created_at: run.created_at,
      updated_at: run.updated_at,
    })),
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/ingest') {
    if (request.method !== 'POST') throw new ApiError('不支持这种请求方式', 405);
    requireAdmin(request, env);
    return dispatchIngest(await readJson<IngestRequest>(request), env);
  }

  if (url.pathname.startsWith('/api/admin/')) {
    requireAdmin(request, env);

    if (url.pathname === '/api/admin/artworks') {
      if (request.method !== 'GET') throw new ApiError('不支持这种请求方式', 405);
      return listAdminArtworks(env);
    }

    if (url.pathname === '/api/admin/runs') {
      if (request.method !== 'GET') throw new ApiError('不支持这种请求方式', 405);
      return recentRuns(env);
    }

    if (url.pathname === '/api/admin/reingest') {
      if (request.method !== 'POST') throw new ApiError('不支持这种请求方式', 405);
      return reingestArtwork(request, env);
    }

    const match = url.pathname.match(/^\/api\/admin\/artworks\/([^/]+)$/);
    if (match) {
      if (request.method !== 'PATCH') throw new ApiError('不支持这种请求方式', 405);
      return updateArtwork(request, decodeURIComponent(match[1]), env);
    }
  }

  throw new ApiError('请求的管理功能不存在', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      return await handleApi(request, env);
    } catch (error) {
      if (error instanceof ApiError) {
        return json({ error: error.message, detail: error.detail }, error.status);
      }
      console.error(error);
      return json({ error: '服务器处理请求时出现了问题' }, 500);
    }
  },
};
