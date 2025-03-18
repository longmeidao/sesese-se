#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime
from pixivpy3 import AppPixivAPI
from pathlib import Path
import requests

def download_profile_image(url, output_path):
    """下载作者头像"""
    try:
        response = requests.get(url, headers={
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        return True
    except Exception as e:
        print(f"Error downloading profile image: {str(e)}")
        return False

def fetch_artwork(artwork_id):
    # 获取 Pixiv REFRESH_TOKEN
    refresh_token = os.environ.get('PIXIV_REFRESH_TOKEN')
    
    if not refresh_token:
        print("Error: PIXIV_REFRESH_TOKEN environment variable is required")
        sys.exit(1)
    
    # 初始化 API 客户端
    api = AppPixivAPI()
    api.auth(refresh_token=refresh_token)
    
    try:
        # 获取作品详情
        artwork = api.illust_detail(artwork_id)
        if not artwork or not artwork.illust:
            print(f"Error: Artwork {artwork_id} not found")
            sys.exit(1)
            
        # 创建输出目录
        output_dir = Path(f"artworks/{artwork_id}")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 下载作者头像
        author_id = artwork.illust.user.id
        profile_image_url = f"https://i.pximg.net/user-profile/img/{author_id}_170.jpg"
        profile_image_path = output_dir / "author_profile.jpg"
        profile_image_success = download_profile_image(profile_image_url, profile_image_path)
        
        # 保存元数据
        metadata = {
            "id": artwork.illust.id,
            "title": artwork.illust.title,
            "caption": artwork.illust.caption,
            "author": {
                "id": artwork.illust.user.id,
                "name": artwork.illust.user.name,
                "account": artwork.illust.user.account,
                "profile_image_url": f"artworks/{artwork_id}/author_profile.jpg" if profile_image_success else "https://s.pximg.net/common/images/no_profile.png"
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