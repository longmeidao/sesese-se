import type { ArtworkSource, ArtworkStatus } from "../types/artwork";

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export const ARTWORK_STATUSES = [
  "active",
  "hidden",
  "deleted",
] as const satisfies readonly ArtworkStatus[];

export function isArtworkStatus(value: unknown): value is ArtworkStatus {
  return (
    typeof value === "string" &&
    ARTWORK_STATUSES.includes(value as ArtworkStatus)
  );
}

export function validateArtworkId(value: string): string {
  if (!/^(pixiv|x|danbooru|other)-[a-zA-Z0-9._-]{1,180}$/.test(value)) {
    throw new ContractError("藏品编号格式不正确");
  }
  return value;
}

export function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export function sanitizeString(
  value: unknown,
  label: string,
  maximum: number,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new ContractError(`${label}格式不正确`);
  const normalized = value.trim();
  if (normalized.length > maximum)
    throw new ContractError(`${label}不能超过 ${maximum} 个字符`);
  return normalized;
}

export function sanitizeTags(value: unknown): string[] | null {
  if (value === null) return null;
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new ContractError("标签格式不正确");
  }
  const tags = value
    .map((item) => item.trim().replace(/^#/, ""))
    .filter(Boolean);
  if (tags.some((tag) => tag.length > 100)) {
    throw new ContractError("标签数量或长度超出限制");
  }
  return [...new Set(tags)];
}

export interface ClassifiedSource {
  source: Extract<ArtworkSource, "pixiv" | "x" | "other">;
  artworkId: string;
  sourceUrl: string;
}

export function classifySource(
  input: string,
  fallbackId = crypto.randomUUID().slice(0, 8),
): ClassifiedSource {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ContractError("url 必须是完整的 http(s) 链接");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new ContractError("只接受 http(s) 链接");

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const pixivMatch = url.pathname.match(/^\/artworks\/(\d+)/);
  if (host === "pixiv.net" && pixivMatch) {
    return {
      source: "pixiv",
      artworkId: pixivMatch[1],
      sourceUrl: `https://www.pixiv.net/artworks/${pixivMatch[1]}`,
    };
  }

  const xMatch = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
  if (["x.com", "twitter.com", "mobile.twitter.com"].includes(host) && xMatch) {
    const sourceUrl = `https://x.com/${xMatch[1]}/status/${xMatch[2]}`;
    return { source: "x", artworkId: sourceUrl, sourceUrl };
  }

  return {
    source: "other",
    artworkId: `${host}-${fallbackId}`,
    sourceUrl: url.toString(),
  };
}
