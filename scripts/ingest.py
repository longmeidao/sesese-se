#!/usr/bin/env python3
"""Fetch artwork, create responsive WebP variants, upload them to object storage,
and write provider-neutral metadata for the Astro content collection.

Pixiv and X have automated adapters. Danbooru and arbitrary sites can use the
direct adapter; adding another first-class adapter only requires returning the
same FetchedArtwork model.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterable
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "src" / "content" / "artworks"
VARIANT_WIDTHS = (640, 960, 1600, 2400)
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024


@dataclass
class RemoteImage:
    url: str
    index: int
    headers: dict[str, str] = field(default_factory=dict)


@dataclass
class FetchedArtwork:
    source_type: str
    source_id: str
    source_url: str
    title: str
    description: str
    published_at: str
    tags: list[str]
    author_id: str
    author_name: str
    author_handle: str
    author_url: str
    images: list[RemoteImage]
    views: int | None = None
    bookmarks: int | None = None
    display_image_index: int = 1


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def safe_identifier(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-.")
    if not cleaned:
        raise ValueError("Artwork ID must contain at least one safe character")
    return cleaned[:160]


def normalize_author_name(value: str) -> str:
    """Remove clearly temporary event/status suffixes without using names for identity.

    The unmodified value is always retained as author.name_raw. The stable provider
    user ID, never this display value, is the identity key.
    """
    name = " ".join(unicodedata.normalize("NFKC", value).split()).strip()
    temporary = re.compile(
        r"(?:C\d{2,3}|コミケ|コミティア|COMITIA|例大祭|新刊|委託|通販|"
        r"お仕事募集中|依頼募集中|Skeb|[0-1]?\d/[0-3]?\d|"
        r"(?:東|西|南|北)[1-8]?[A-Za-zあ-んア-ン]-?\d{1,2}[ab]?)",
        re.IGNORECASE,
    )
    # Remove a trailing bracket only when it contains a known temporary marker.
    name = re.sub(
        r"\s*[\(（\[【][^\)）\]】]*(?:C\d{2,3}|コミケ|コミティア|COMITIA|例大祭|新刊|委託|通販|募集中|Skeb|\d{1,2}/\d{1,2})[^\)）\]】]*[\)）\]】]\s*$",
        "",
        name,
        flags=re.IGNORECASE,
    ).strip()
    # Remove a separator suffix only when the suffix itself looks temporary.
    parts = re.split(r"\s*(?:@|＠|\||｜)\s*", name, maxsplit=1)
    if len(parts) == 2 and temporary.search(parts[1]):
        name = parts[0].strip()
    return name or value.strip()


def parse_x_status(value: str, source_url: str = "") -> tuple[str, str]:
    candidate = value if "/status/" in value else source_url
    match = re.search(r"(?:https?://)?(?:www\.)?(?:x|twitter)\.com/([^/]+)/status/(\d+)", candidate)
    if match:
        handle, status_id = match.groups()
        return status_id, f"https://x.com/{handle}/status/{status_id}"
    if value.isdigit():
        return value, source_url or f"https://x.com/i/status/{value}"
    raise ValueError("X input must be a complete x.com status URL or numeric status ID")


def x_title(text: str, author_name: str, status_id: str) -> str:
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    cleaned = re.sub(r"https?://\S+", "", first_line)
    cleaned = re.sub(r"(?:^|\s)#[\w\u0080-\uffff]+", " ", cleaned)
    cleaned = " ".join(cleaned.split()).strip(" -—·")
    return cleaned[:120] or f"{author_name} · X {status_id}"


def fetch_x_official(status_id: str, status_url: str, token: str) -> FetchedArtwork:
    response = requests.get(
        f"https://api.x.com/2/tweets/{status_id}",
        headers={"Authorization": f"Bearer {token}", "User-Agent": "sesese-se-ingest/2.0"},
        params={
            "tweet.fields": "created_at,entities,public_metrics,attachments",
            "expansions": "author_id,attachments.media_keys",
            "user.fields": "id,name,username",
            "media.fields": "type,url,preview_image_url,width,height,alt_text",
        },
        timeout=(15, 45),
    )
    response.raise_for_status()
    payload = response.json()
    post = payload["data"]
    user = payload.get("includes", {}).get("users", [{}])[0]
    photos = [item for item in payload.get("includes", {}).get("media", []) if item.get("type") == "photo"]
    if not photos:
        raise RuntimeError("The X post has no downloadable photos")
    tags = [item["tag"] for item in post.get("entities", {}).get("hashtags", [])]
    text = post.get("text", "")
    metrics = post.get("public_metrics", {})
    return FetchedArtwork(
        source_type="x",
        source_id=status_id,
        source_url=status_url,
        title=x_title(text, user.get("name", user.get("username", "X")), status_id),
        description=text,
        published_at=post.get("created_at") or datetime.now(timezone.utc).isoformat(),
        tags=tags,
        author_id=str(user.get("id") or post.get("author_id") or user.get("username")),
        author_name=user.get("name") or user.get("username") or "X author",
        author_handle=user.get("username", ""),
        author_url=f"https://x.com/{user.get('username', '')}",
        images=[
            RemoteImage(url=item["url"], index=index, headers={"Referer": "https://x.com/"})
            for index, item in enumerate(photos, start=1)
        ],
        views=int(metrics.get("impression_count", 0)),
        bookmarks=int(metrics.get("bookmark_count", 0)),
    )


def fetch_x_free(status_id: str, status_url: str) -> FetchedArtwork:
    """Best-effort free X lookup through the open-source FxTwitter service."""
    response = requests.get(
        f"https://api.fxtwitter.com/status/{status_id}",
        headers={"User-Agent": "sesese-se-ingest/2.0 (+https://sesese.se)"},
        timeout=(15, 45),
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("code") != 200 or "tweet" not in payload:
        raise RuntimeError(payload.get("message", "FxTwitter could not read this X post"))
    post = payload["tweet"]
    author = post.get("author", {})
    photos = post.get("media", {}).get("photos", [])
    if not photos:
        raise RuntimeError("The X post has no downloadable photos")
    facets = post.get("raw_text", {}).get("facets", [])
    tags = [item.get("original", "").lstrip("#") for item in facets if item.get("type") == "hashtag"]
    tags = [tag for tag in tags if tag]
    text = post.get("text", "")
    return FetchedArtwork(
        source_type="x",
        source_id=str(post.get("id") or status_id),
        source_url=post.get("url") or status_url,
        title=x_title(text, author.get("name", author.get("screen_name", "X")), status_id),
        description=text,
        published_at=datetime.fromtimestamp(int(post["created_timestamp"]), tz=timezone.utc).isoformat()
        if post.get("created_timestamp") else datetime.now(timezone.utc).isoformat(),
        tags=tags,
        author_id=str(author.get("id") or author.get("screen_name")),
        author_name=author.get("name") or author.get("screen_name") or "X author",
        author_handle=author.get("screen_name", ""),
        author_url=author.get("url") or f"https://x.com/{author.get('screen_name', '')}",
        images=[
            RemoteImage(url=item["url"], index=index, headers={"Referer": "https://x.com/"})
            for index, item in enumerate(photos, start=1)
        ],
        views=int(post.get("views", 0)),
        bookmarks=int(post.get("bookmarks", 0)),
    )


def fetch_x(value: str, source_url: str = "") -> FetchedArtwork:
    status_id, status_url = parse_x_status(value, source_url)
    token = os.environ.get("X_BEARER_TOKEN")
    if token:
        print("using paid official X API")
        return fetch_x_official(status_id, status_url, token)
    print("using free FxTwitter lookup (best effort)")
    return fetch_x_free(status_id, status_url)


def fetch_pixiv(artwork_id: str) -> FetchedArtwork:
    from pixivpy3 import AppPixivAPI

    refresh_token = os.environ.get("PIXIV_REFRESH_TOKEN")
    if not refresh_token:
        raise RuntimeError("PIXIV_REFRESH_TOKEN is required for Pixiv ingestion")

    api = AppPixivAPI()
    api.auth(refresh_token=refresh_token)
    result = api.illust_detail(int(artwork_id))
    if "illust" not in result:
        message = result.get("error", {}).get("message", "Unknown Pixiv API error")
        raise RuntimeError(f"Could not fetch Pixiv artwork {artwork_id}: {message}")

    artwork = result.illust
    if artwork.page_count == 1:
        urls = [artwork.meta_single_page.get("original_image_url")]
    else:
        urls = [page.image_urls.get("original") for page in artwork.meta_pages]
    images = [
        RemoteImage(url=url, index=index, headers={"Referer": "https://www.pixiv.net/"})
        for index, url in enumerate(urls, start=1)
        if url
    ]
    if not images:
        raise RuntimeError("The Pixiv artwork has no downloadable images")

    return FetchedArtwork(
        source_type="pixiv",
        source_id=str(artwork.id),
        source_url=f"https://www.pixiv.net/artworks/{artwork.id}",
        title=artwork.title,
        description=artwork.caption or "",
        published_at=artwork.create_date,
        tags=[tag.name for tag in artwork.tags],
        author_id=str(artwork.user.id),
        author_name=artwork.user.name,
        author_handle=artwork.user.account or "",
        author_url=f"https://www.pixiv.net/users/{artwork.user.id}",
        images=images,
        views=int(artwork.total_view),
        bookmarks=int(artwork.total_bookmarks),
    )


def fetch_direct(args: argparse.Namespace) -> FetchedArtwork:
    image_urls = [line.strip() for line in args.image_urls.splitlines() if line.strip()]
    images = [
        RemoteImage(url=url, index=index, headers={"Referer": args.source_url})
        for index, url in enumerate(image_urls, start=1)
    ]
    if not args.source_url or not image_urls:
        raise ValueError("Direct ingestion requires --source-url and --image-urls")
    if not args.title or not args.author_name:
        raise ValueError("Direct ingestion requires --title and --author-name")

    host = urlparse(args.source_url).hostname or args.source
    return FetchedArtwork(
        source_type=args.source,
        source_id=args.id,
        source_url=args.source_url,
        title=args.title,
        description=args.description or "",
        published_at=args.published_at or datetime.now(timezone.utc).isoformat(),
        tags=parse_csv(args.tags),
        author_id=args.author_id or safe_identifier(args.author_name),
        author_name=args.author_name,
        author_handle=args.author_handle or "",
        author_url=args.author_url or f"https://{host}",
        images=images,
    )


def download_image(remote: RemoteImage) -> bytes:
    headers = {
        "User-Agent": "sesese-se-ingest/2.0 (+https://sesese.se)",
        **remote.headers,
    }
    with requests.get(remote.url, headers=headers, timeout=(15, 90), stream=True) as response:
        response.raise_for_status()
        content_length = int(response.headers.get("content-length", "0") or 0)
        if content_length > MAX_DOWNLOAD_BYTES:
            raise ValueError(f"Image exceeds the {MAX_DOWNLOAD_BYTES // 1024 // 1024} MiB limit")
        chunks: list[bytes] = []
        downloaded = 0
        for chunk in response.iter_content(1024 * 1024):
            downloaded += len(chunk)
            if downloaded > MAX_DOWNLOAD_BYTES:
                raise ValueError(f"Image exceeds the {MAX_DOWNLOAD_BYTES // 1024 // 1024} MiB limit")
            chunks.append(chunk)
        return b"".join(chunks)


class R2Storage:
    def __init__(self, force: bool = False):
        import boto3
        from botocore.config import Config

        account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        access_key = os.environ.get("R2_ACCESS_KEY_ID")
        secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
        self.bucket = os.environ.get("R2_BUCKET", "sesese-se-media")
        if not account_id or not access_key or not secret_key:
            raise RuntimeError(
                "CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required"
            )
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=Config(signature_version="s3v4", retries={"max_attempts": 4, "mode": "standard"}),
        )
        self.force = force

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as error:
            status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status == 404:
                return False
            raise

    def put_webp(self, key: str, payload: bytes) -> None:
        if not self.force and self.exists(key):
            print(f"skip existing r2://{self.bucket}/{key}")
            return
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=payload,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000, immutable",
        )
        print(f"uploaded r2://{self.bucket}/{key} ({len(payload)} bytes)")


def target_dimensions(width: int, height: int) -> list[tuple[int, int]]:
    longest = max(width, height)
    largest = min(longest, VARIANT_WIDTHS[-1])
    edges = [candidate for candidate in VARIANT_WIDTHS if candidate < largest]
    edges.append(largest)
    dimensions: list[tuple[int, int]] = []
    for edge in sorted(set(edges)):
        if width >= height:
            dimensions.append((edge, max(1, round(height * edge / width))))
        else:
            dimensions.append((max(1, round(width * edge / height)), edge))
    return dimensions


def encode_variants(raw: bytes, source_type: str, source_id: str, page: int) -> tuple[int, int, str, list[dict], list[tuple[str, bytes]]]:
    from PIL import Image, ImageOps

    content_hash = f"sha256:{hashlib.sha256(raw).hexdigest()}"
    with Image.open(io.BytesIO(raw)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        original_width, original_height = image.size
        variants: list[dict] = []
        uploads: list[tuple[str, bytes]] = []

        dimensions = target_dimensions(original_width, original_height)
        for index, (width, height) in enumerate(dimensions):
            resized = image if (width, height) == image.size else image.resize((width, height), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            resized.save(output, format="WEBP", quality=84, method=6, optimize=True)
            payload = output.getvalue()
            filename = "original.webp" if index == len(dimensions) - 1 else f"{width}w.webp"
            key = f"media/{source_type}/{safe_identifier(source_id)}/{page}/{filename}"
            variants.append({
                "key": key,
                "format": "webp",
                "width": width,
                "height": height,
                "bytes": len(payload),
            })
            uploads.append((key, payload))

        display_width, display_height = dimensions[-1]
        return display_width, display_height, content_hash, variants, uploads


def existing_collected_at(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("collected_at")
    except (json.JSONDecodeError, OSError):
        return None


def find_duplicate(content_hash: str, content_id: str) -> Path | None:
    for path in CONTENT_DIR.glob("*.json"):
        if path.stem == content_id:
            continue
        try:
            if json.loads(path.read_text(encoding="utf-8")).get("content_hash") == content_hash:
                return path
        except (json.JSONDecodeError, OSError):
            continue
    return None


def write_metadata(artwork: FetchedArtwork, media: list[dict], content_hash: str, allow_duplicate: bool) -> Path:
    content_id = f"{artwork.source_type}-{safe_identifier(artwork.source_id)}"
    output_path = CONTENT_DIR / f"{content_id}.json"
    collected_at = existing_collected_at(output_path) or datetime.now(timezone.utc).isoformat()
    duplicate = find_duplicate(content_hash, content_id)
    if duplicate and not allow_duplicate:
        raise RuntimeError(f"duplicate media set already exists in {duplicate.relative_to(ROOT)}")
    raw_author_name = artwork.author_name.strip()
    metadata = {
        "schema_version": 2,
        "id": content_id,
        "content_hash": content_hash,
        "display_image_index": artwork.display_image_index,
        "source": {
            "type": artwork.source_type,
            "id": artwork.source_id,
            "url": artwork.source_url,
        },
        "title": artwork.title,
        "description": artwork.description,
        "published_at": artwork.published_at,
        "collected_at": collected_at,
        "tags": artwork.tags,
        "author": {
            "id": artwork.author_id,
            "name": normalize_author_name(raw_author_name),
            **({"name_raw": raw_author_name} if normalize_author_name(raw_author_name) != raw_author_name else {}),
            **({"handle": artwork.author_handle} if artwork.author_handle else {}),
            "url": artwork.author_url,
        },
        "media": media,
        **({
            "metrics": {
                **({"views": artwork.views} if artwork.views is not None else {}),
                **({"bookmarks": artwork.bookmarks} if artwork.bookmarks is not None else {}),
            }
        } if artwork.views is not None or artwork.bookmarks is not None else {}),
    }
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {output_path.relative_to(ROOT)}")
    return output_path


def ingest(artwork: FetchedArtwork, force: bool, allow_duplicate: bool) -> Path:
    storage = R2Storage(force=force)
    media: list[dict] = []
    media_hashes: list[str] = []
    with TemporaryDirectory(prefix="sesese-ingest-"):
        for remote in artwork.images:
            page = remote.index
            print(f"downloading {artwork.source_type}:{artwork.source_id} source image {page}")
            raw = download_image(remote)
            width, height, content_hash, variants, uploads = encode_variants(
                raw, artwork.source_type, artwork.source_id, page
            )
            media_hashes.append(content_hash.removeprefix("sha256:"))
            for key, payload in uploads:
                storage.put_webp(key, payload)
            media.append({
                "index": page,
                "width": width,
                "height": height,
                "alt": artwork.title,
                "content_hash": content_hash,
                "variants": variants,
            })
    artwork_hash = "sha256:" + hashlib.sha256("\n".join(media_hashes).encode()).hexdigest()
    return write_metadata(artwork, media, artwork_hash, allow_duplicate)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest artwork into sesese-se")
    parser.add_argument("--source", choices=("pixiv", "x", "danbooru", "other"), required=True)
    parser.add_argument("--id", required=True, help="Provider artwork ID or stable slug")
    parser.add_argument("--display-image", type=int, default=1, help="One-based source image to display")
    parser.add_argument("--source-url", default="")
    parser.add_argument("--image-urls", default="", help="One direct image URL per line")
    parser.add_argument("--title", default="")
    parser.add_argument("--description", default="")
    parser.add_argument("--published-at", default="")
    parser.add_argument("--tags", default="")
    parser.add_argument("--author-id", default="")
    parser.add_argument("--author-name", default="")
    parser.add_argument("--author-handle", default="")
    parser.add_argument("--author-url", default="")
    parser.add_argument("--force", action="store_true", help="Overwrite existing R2 objects")
    parser.add_argument("--allow-duplicate", action="store_true", help="Allow an identical media set under another source")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.source == "pixiv":
            artwork = fetch_pixiv(args.id)
        elif args.source == "x":
            try:
                artwork = fetch_x(args.id, args.source_url)
            except Exception:
                if not args.image_urls:
                    raise
                print("automatic X lookup failed; using supplied direct metadata", file=sys.stderr)
                artwork = fetch_direct(args)
        else:
            artwork = fetch_direct(args)
        selected = next((image for image in artwork.images if image.index == args.display_image), None)
        if selected is None:
            available = ", ".join(str(image.index) for image in artwork.images)
            raise ValueError(f"display image {args.display_image} is unavailable; available pages: {available}")
        artwork.images = [selected]
        artwork.display_image_index = args.display_image
        output = ingest(artwork, force=args.force, allow_duplicate=args.allow_duplicate)
        print(f"done: {output}")
        return 0
    except Exception as error:
        print(f"ingestion failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
