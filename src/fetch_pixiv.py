#!/usr/bin/env python3
import os
import sys
import json
import requests
from pixivpy3 import *
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def download_file(url, output_dir, filename):
    """下载文件到指定目录"""
    try:
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        
        # 构建输出路径（使用正斜杠）
        output_path = f"{output_dir}/{filename}"
        
        # 下载文件
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # 保存文件
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return output_path
    except Exception as e:
        print(f"下载文件失败: {e}")
        return None

def fetch_artwork(artwork_id):
    """获取作品信息并下载相关文件"""
    try:
        # 初始化 Pixiv API
        api = AppPixivAPI()
        api.auth(refresh_token=os.getenv('PIXIV_REFRESH_TOKEN'))
        
        # 获取作品详情
        artwork = api.illust_detail(artwork_id)
        if not artwork or not artwork.illust:
            print(f"未找到作品: {artwork_id}")
            return
        
        # 创建作品目录（使用正斜杠）
        artwork_dir = f"artworks/{artwork_id}"
        os.makedirs(artwork_dir, exist_ok=True)
        
        # 下载作者头像
        author_profile_path = None
        if artwork.illust.user.profile_image_urls.medium:
            author_profile_path = download_file(
                artwork.illust.user.profile_image_urls.medium,
                artwork_dir,
                "author_profile.jpg"
            )
        
        # 下载作品图片
        image_paths = []
        if artwork.illust.meta_pages:
            # 多图作品
            for i, page in enumerate(artwork.illust.meta_pages):
                image_url = page.image_urls.original
                image_path = download_file(
                    image_url,
                    artwork_dir,
                    f"image_{i+1}.jpg"
                )
                if image_path:
                    image_paths.append(f"artworks/{artwork_id}/image_{i+1}.jpg")
        else:
            # 单图作品
            image_url = artwork.illust.image_urls.original
            image_path = download_file(
                image_url,
                artwork_dir,
                "image_1.jpg"
            )
            if image_path:
                image_paths.append(f"artworks/{artwork_id}/image_1.jpg")
        
        # 构建元数据
        metadata = {
            "id": artwork_id,
            "title": artwork.illust.title,
            "author": {
                "id": artwork.illust.user.id,
                "name": artwork.illust.user.name,
                "account": artwork.illust.user.account,
                "profile_image": f"artworks/{artwork_id}/author_profile.jpg" if author_profile_path else None
            },
            "description": artwork.illust.caption,
            "tags": [tag.name for tag in artwork.illust.tags],
            "create_date": artwork.illust.create_date,
            "width": artwork.illust.width,
            "height": artwork.illust.height,
            "total_view": artwork.illust.total_view,
            "total_bookmarks": artwork.illust.total_bookmarks,
            "is_bookmarked": artwork.illust.is_bookmarked,
            "total_comments": artwork.illust.total_comments,
            "images": image_paths
        }
        
        # 保存元数据
        metadata_path = f"{artwork_dir}/metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        print(f"成功获取作品 {artwork_id}")
        
    except Exception as e:
        print(f"获取作品失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使用方法: python fetch_pixiv.py <artwork_id>")
        sys.exit(1)
    
    artwork_id = sys.argv[1]
    fetch_artwork(artwork_id) 