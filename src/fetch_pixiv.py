#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime
from pixivpy3 import AppPixivAPI
from pathlib import Path

def fetch_artwork(artwork_id):
    # 获取 Pixiv 登录凭证
    username = os.environ.get('PIXIV_USERNAME')
    password = os.environ.get('PIXIV_PASSWORD')
    
    if not username or not password:
        print("Error: PIXIV_USERNAME and PIXIV_PASSWORD environment variables are required")
        sys.exit(1)
    
    # 初始化 API 客户端
    api = AppPixivAPI()
    api.login(username, password)
    
    try:
        # 获取作品详情
        artwork = api.illust_detail(artwork_id)
        if not artwork or not artwork.illust:
            print(f"Error: Artwork {artwork_id} not found")
            sys.exit(1)
            
        # 创建输出目录
        output_dir = Path(f"artworks/{artwork_id}")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存元数据
        metadata = {
            "id": artwork.illust.id,
            "title": artwork.illust.title,
            "caption": artwork.illust.caption,
            "author": {
                "id": artwork.illust.user.id,
                "name": artwork.illust.user.name,
                "account": artwork.illust.user.account
            },
            "tags": [tag.name for tag in artwork.illust.tags],
            "create_date": artwork.illust.create_date,
            "page_count": artwork.illust.page_count,
            "width": artwork.illust.width,
            "height": artwork.illust.height,
            "total_view": artwork.illust.total_view,
            "total_bookmarks": artwork.illust.total_bookmarks,
            "is_bookmarked": artwork.illust.is_bookmarked,
            "is_muted": artwork.illust.is_muted,
            "meta_pages": artwork.illust.meta_pages,
            "meta_single_page": artwork.illust.meta_single_page
        }
        
        with open(output_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            
        # 下载图片
        if artwork.illust.meta_pages:
            # 多页作品
            for idx, page in enumerate(artwork.illust.meta_pages):
                image_url = page.image_urls.original
                api.download(image_url, path=str(output_dir), name=f"page_{idx+1}.jpg")
        else:
            # 单页作品
            image_url = artwork.illust.meta_single_page.original_image_url
            api.download(image_url, path=str(output_dir), name="page_1.jpg")
            
        print(f"Successfully downloaded artwork {artwork_id}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python fetch_pixiv.py <artwork_id>")
        sys.exit(1)
        
    artwork_id = sys.argv[1]
    fetch_artwork(artwork_id) 