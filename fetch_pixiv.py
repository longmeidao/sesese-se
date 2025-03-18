#!/usr/bin/env python3
"""
Pixiv 作品获取脚本
用于获取指定 ID 的 Pixiv 作品内容和元数据
"""

import os
import json
import time
import random
import requests
import sys
from pixivpy3 import AppPixivAPI

def download_file(url, output_dir, filename):
    """通用下载函数，用于下载头像和图片"""
    os.makedirs(output_dir, exist_ok=True)
    full_path = os.path.join(output_dir, filename)
    
    try:
        headers = {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, stream=True)
        response.raise_for_status()
        
        with open(full_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return full_path
    except Exception as e:
        print(f"下载文件失败: {e}")
        return None

def create_metadata(artwork):
    """创建作品元数据"""
    return {
        "id": artwork.id,
        "title": artwork.title,
        "caption": artwork.caption,
        "create_date": artwork.create_date,
        "tags": [tag.name for tag in artwork.tags],
        "page_count": artwork.page_count,
        "author": {
            "id": artwork.user.id,
            "name": artwork.user.name,
            "account": artwork.user.account,
            "profile_image_url": artwork.user.profile_image_urls.medium
        },
        "total_bookmarks": artwork.total_bookmarks,
        "total_view": artwork.total_view,
        "images": [],
        "is_muted": False
    }

def fetch_artwork(api, artwork_id):
    """获取Pixiv作品详情并下载图片"""
    try:
        # 获取作品详情
        detail_result = api.illust_detail(artwork_id)
        if 'illust' not in detail_result:
            print(f"Error: 无法获取作品 {artwork_id} 的详情: {detail_result.get('error', {}).get('message', 'Unknown error')}")
            return False
            
        artwork = detail_result.illust
        
        # 创建内容目录
        content_dir = os.path.join('src', 'content')
        os.makedirs(content_dir, exist_ok=True)
        
        # 创建图片保存目录 - Astro Image 组件需要的路径
        images_dir = os.path.join(content_dir, 'images', 'pixiv', str(artwork_id))
        os.makedirs(images_dir, exist_ok=True)
        
        # 为图片集合创建索引文件目录
        images_collection_dir = os.path.join(content_dir, 'images')
        os.makedirs(images_collection_dir, exist_ok=True)
        
        # 创建原始作品数据目录 (备份用)
        artworks_dir = os.path.join('artworks', str(artwork_id))
        os.makedirs(artworks_dir, exist_ok=True)
        
        # 创建作品元数据
        metadata = create_metadata(artwork)
        
        # 下载作者头像
        profile_image_url = metadata['author']['profile_image_url']
        avatar_filename = f"author_profile.jpg"
        
        # 同时保存到备份目录和内容目录
        download_file(profile_image_url, artworks_dir, avatar_filename)
        profile_path = download_file(profile_image_url, images_dir, avatar_filename)
        
        if profile_path:
            # 更新元数据中的头像路径为 Astro Image 组件可识别的格式
            # 使用相对于 src/ 的绝对路径，以 / 开头
            rel_profile_path = f"/src/content/images/pixiv/{artwork_id}/{avatar_filename}"
            metadata['author']['profile_image_url'] = rel_profile_path
        
        # 下载作品图片
        if artwork.page_count == 1:
            # 单图
            image_url = artwork.meta_single_page.get('original_image_url')
            if image_url:
                filename = f"image_1.jpg"
                
                # 同时保存到备份目录和内容目录
                download_file(image_url, artworks_dir, filename)
                image_path = download_file(image_url, images_dir, filename)
                
                if image_path:
                    # 添加 Astro Image 组件可识别的路径到元数据
                    rel_image_path = f"/src/content/images/pixiv/{artwork_id}/{filename}"
                    metadata['images'].append(rel_image_path)
        else:
            # 多图
            for i, image in enumerate(artwork.meta_pages):
                image_url = image.image_urls.get('original')
                if image_url:
                    filename = f"image_{i+1}.jpg"
                    
                    # 同时保存到备份目录和内容目录
                    download_file(image_url, artworks_dir, filename)
                    image_path = download_file(image_url, images_dir, filename)
                    
                    if image_path:
                        # 添加 Astro Image 组件可识别的路径到元数据
                        rel_image_path = f"/src/content/images/pixiv/{artwork_id}/{filename}"
                        metadata['images'].append(rel_image_path)
                        
                    # 添加随机延迟，避免请求过快
                    time.sleep(random.uniform(1, 2))
        
        # 保存元数据到备份目录
        with open(os.path.join(artworks_dir, 'metadata.json'), 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            
        # 创建图片集合索引文件 (空的，仅用于标记目录)
        with open(os.path.join(images_collection_dir, 'index.json'), 'w', encoding='utf-8') as f:
            json.dump({}, f)
            
        # 保存元数据到内容集合目录
        pixiv_content_dir = os.path.join(content_dir, 'pixiv')
        os.makedirs(pixiv_content_dir, exist_ok=True)
        with open(os.path.join(pixiv_content_dir, f"{artwork_id}.json"), 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            
        print(f"✅ 成功获取并保存作品 {artwork_id}")
        print(f"图片已保存到: {images_dir}")
        print(f"元数据已保存到: {os.path.join(pixiv_content_dir, f'{artwork_id}.json')}")
        return True
    except Exception as e:
        print(f"获取作品时发生错误: {e}")
        return False

if __name__ == "__main__":
    # 获取命令行参数中的作品ID
    if len(sys.argv) != 2:
        print("用法: python fetch_pixiv.py <artwork_id>")
        sys.exit(1)
        
    artwork_id = sys.argv[1]
    print(f"准备获取作品ID: {artwork_id}")
    
    # 使用 refresh_token 创建 API 实例
    api = AppPixivAPI()
    refresh_token = os.environ.get('PIXIV_REFRESH_TOKEN')
    if not refresh_token:
        print("Error: PIXIV_REFRESH_TOKEN 环境变量未设置")
        sys.exit(1)
        
    try:
        api.auth(refresh_token=refresh_token)
        if fetch_artwork(api, artwork_id):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"认证或获取作品时发生错误: {e}")
        sys.exit(1) 