#!/usr/bin/env python3
"""Delete expired soft-deleted artwork media from R2 and remove its metadata file."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "src" / "content" / "artworks"


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def expired_artworks(retention_days: int) -> list[tuple[Path, dict]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    expired: list[tuple[Path, dict]] = []
    for path in sorted(CONTENT_DIR.glob("*.json")):
        try:
            artwork = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if artwork.get("schema_version") != 2 or artwork.get("status") != "deleted":
            continue
        deleted_at = artwork.get("deleted_at")
        if not isinstance(deleted_at, str):
            print(f"skip {path.name}: deleted_at is missing")
            continue
        try:
            if parse_datetime(deleted_at) <= cutoff:
                expired.append((path, artwork))
        except ValueError:
            print(f"skip {path.name}: deleted_at is invalid")
    return expired


def media_keys(artwork: dict) -> list[str]:
    keys: list[str] = []
    for media in artwork.get("media", []):
        for variant in media.get("variants", []):
            key = variant.get("key")
            if isinstance(key, str) and key and key not in keys:
                keys.append(key)
    return keys


def r2_client():
    import boto3
    from botocore.config import Config

    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not account_id or not access_key or not secret_key:
        raise RuntimeError(
            "CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required"
        )
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 4, "mode": "standard"}),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retention-days", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.retention_days < 0:
        parser.error("--retention-days must be zero or greater")

    expired = expired_artworks(args.retention_days)
    if not expired:
        print("no expired soft-deleted artworks")
        return 0

    bucket = os.environ.get("R2_BUCKET", "sesese-se-media")
    client = None if args.dry_run else r2_client()
    for path, artwork in expired:
        keys = media_keys(artwork)
        print(f"{'would clean' if args.dry_run else 'cleaning'} {artwork.get('id', path.stem)}: {len(keys)} objects")
        if args.dry_run:
            continue
        if keys:
            result = client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": key} for key in keys], "Quiet": True},
            )
            if result.get("Errors"):
                raise RuntimeError(f"R2 failed to delete objects for {artwork.get('id', path.stem)}: {result['Errors']}")
        path.unlink()
        print(f"removed {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
