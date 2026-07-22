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

function classifySource(input: string): { source: 'pixiv' | 'x' | 'other'; artworkId: string; sourceUrl: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('url 必须是完整的 http(s) 链接');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('只接受 http(s) 链接');
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

async function dispatchIngest(request: Request, env: Env): Promise<Response> {
  if (!env.INGEST_WEBHOOK_SECRET || !env.GITHUB_TOKEN) {
    return json({ error: 'Worker secrets are not configured' }, 503);
  }

  const authorization = request.headers.get('authorization') ?? '';
  const suppliedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!safeEqual(suppliedSecret, env.INGEST_WEBHOOK_SECRET)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let input: IngestRequest;
  try {
    input = await request.json() as IngestRequest;
  } catch {
    return json({ error: 'Request body must be JSON' }, 400);
  }

  if (typeof input.url !== 'string' || input.url.length > 2048) {
    return json({ error: 'url is required and must be shorter than 2048 characters' }, 400);
  }

  const displayImage = input.display_image ?? 1;
  if (!Number.isInteger(displayImage) || displayImage < 1 || displayImage > 100) {
    return json({ error: 'display_image must be an integer between 1 and 100' }, 400);
  }

  let parsed: ReturnType<typeof classifySource>;
  try {
    parsed = classifySource(input.url);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid URL' }, 400);
  }

  if (parsed.source === 'other' && (!input.image_urls || !input.title || !input.author_name)) {
    return json({
      error: '任意网站目前还需要 image_urls、title 和 author_name；Pixiv 与 X 只需分享作品链接',
    }, 400);
  }

  const owner = env.GITHUB_OWNER || 'longmeidao';
  const repo = env.GITHUB_REPO || 'sesese-se';
  const ref = env.GITHUB_REF || 'main';
  const workflowUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/ingest-artwork.yml/dispatches`;
  const response = await fetch(workflowUrl, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'sesese-se-ingest-worker',
      'x-github-api-version': '2022-11-28',
    },
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
        force: 'false',
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    return json({ error: 'GitHub workflow dispatch failed', status: response.status, detail }, 502);
  }

  return json({
    accepted: true,
    source: parsed.source,
    artwork_id: parsed.artworkId,
    display_image: displayImage,
    actions_url: `https://github.com/${owner}/${repo}/actions/workflows/ingest-artwork.yml`,
  }, 202);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/ingest') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
      }
      return dispatchIngest(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
