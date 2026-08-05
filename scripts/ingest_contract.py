"""Pure ingestion rules shared by the CLI and its tests."""

from __future__ import annotations

import re
import unicodedata

VARIANT_WIDTHS = (640, 960, 1600, 2400)

# 原图按下载到的字节原样留存，所以扩展名和 Content-Type 必须跟着来源格式走，
# 不能一律当成 PNG。键是 Pillow 报告的格式名。
SOURCE_FORMATS = {
    "PNG": ("png", "image/png"),
    "JPEG": ("jpg", "image/jpeg"),
    "WEBP": ("webp", "image/webp"),
    "GIF": ("gif", "image/gif"),
    "AVIF": ("avif", "image/avif"),
}


def source_descriptor(pillow_format: str | None) -> tuple[str, str]:
    """Map a Pillow format name to the archival file extension and Content-Type."""
    if not pillow_format:
        raise ValueError("Could not determine the source image format")
    try:
        return SOURCE_FORMATS[pillow_format.upper()]
    except KeyError:
        raise ValueError(f"Unsupported source image format: {pillow_format}") from None


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def safe_identifier(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-.")
    if not cleaned:
        raise ValueError("Artwork ID must contain at least one safe character")
    return cleaned[:160]


def normalize_author_name(value: str) -> str:
    name = " ".join(unicodedata.normalize("NFKC", value).split()).strip()
    temporary = re.compile(
        r"(?:C\d{2,3}|コミケ|コミティア|COMITIA|例大祭|新刊|委託|通販|"
        r"お仕事募集中|依頼募集中|Skeb|[0-1]?\d/[0-3]?\d|"
        r"(?:東|西|南|北)[1-8]?[A-Za-zあ-んア-ン]-?\d{1,2}[ab]?)",
        re.IGNORECASE,
    )
    name = re.sub(
        r"\s*[\(（\[【][^\)）\]】]*(?:C\d{2,3}|コミケ|コミティア|COMITIA|例大祭|新刊|委託|通販|募集中|Skeb|\d{1,2}/\d{1,2})[^\)）\]】]*[\)）\]】]\s*$",
        "",
        name,
        flags=re.IGNORECASE,
    ).strip()
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

