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

def fetch_artwork(api, artwork_id, exclude_images=None):
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
        images_dir = os.path.join(content_dir, 'images', 'pixiv')
        os.makedirs(images_dir, exist_ok=True)
        
        # 创建作品元数据
        metadata = create_metadata(artwork)
        
        # 下载作者头像
        profile_image_url = metadata['author']['profile_image_url']
        avatar_filename = f"{artwork_id}_author_profile.jpg"
        
        # 保存到内容目录
        profile_path = download_file(profile_image_url, images_dir, avatar_filename)
        
        if profile_path:
            # 更新元数据中的头像路径为 Astro Image 组件可识别的格式
            rel_profile_path = f"/images/pixiv/{avatar_filename}"
            metadata['author']['profile_image_url'] = rel_profile_path
        
        # 处理要排除的图片索引
        exclude_indices = set()
        if exclude_images:
            try:
                exclude_indices = {int(idx.strip()) for idx in exclude_images.split(',')}
                print(f"将排除以下图片索引: {exclude_indices}")
            except ValueError as e:
                print(f"警告: 无效的排除索引格式: {e}")
        
        # 下载作品图片
        if artwork.page_count == 1:
            # 单图
            image_url = artwork.meta_single_page.get('original_image_url')
            if image_url and 0 not in exclude_indices:
                filename = f"{artwork_id}_1.jpg"
                
                # 保存到内容目录
                image_path = download_file(image_url, images_dir, filename)
                
                if image_path:
                    # 添加 Astro Image 组件可识别的路径到元数据
                    rel_image_path = f"/images/pixiv/{filename}"
                    metadata['images'].append(rel_image_path)
        else:
            # 多图
            for i, image in enumerate(artwork.meta_pages):
                if i in exclude_indices:
                    print(f"跳过图片索引 {i}")
                    continue
                    
                image_url = image.image_urls.get('original')
                if image_url:
                    filename = f"{artwork_id}_{i+1}.jpg"
                    
                    # 保存到内容目录
                    image_path = download_file(image_url, images_dir, filename)
                    
                    if image_path:
                        # 添加 Astro Image 组件可识别的路径到元数据
                        rel_image_path = f"/images/pixiv/{filename}"
                        metadata['images'].append(rel_image_path)
                        
                    # 添加随机延迟，避免请求过快
                    time.sleep(random.uniform(1, 2))
            
        # 读取现有的元数据文件
        metadata_file = os.path.join(content_dir, 'pixiv', 'artworks.json')
        artworks_data = {}
        
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                artworks_data = json.load(f)
        
        # 更新或添加新作品的元数据
        artworks_data[artwork_id] = metadata
        
        # 保存更新后的元数据
        os.makedirs(os.path.dirname(metadata_file), exist_ok=True)
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(artworks_data, f, ensure_ascii=False, indent=2)
            
        print(f"✅ 成功获取并保存作品 {artwork_id}")
        print(f"图片已保存到: {images_dir}")
        print(f"元数据已保存到: {metadata_file}")
        return True
    except Exception as e:
        print(f"获取作品时发生错误: {e}")
        return False

if __name__ == "__main__":
    # 获取命令行参数中的作品ID和排除图片索引
    if len(sys.argv) < 2:
        print("用法: python fetch_pixiv.py <artwork_id> [exclude_images]")
        print("exclude_images: 要排除的图片索引（用逗号分隔，从0开始），例如：0,2,3 表示排除第1、3、4张图片")
        sys.exit(1)
        
    artwork_id = sys.argv[1]
    exclude_images = sys.argv[2] if len(sys.argv) > 2 else None
    print(f"准备获取作品ID: {artwork_id}")
    if exclude_images:
        print(f"将排除的图片索引: {exclude_images}")

    # 使用 refresh_token 创建 API 实例
    api = AppPixivAPI()
    refresh_token = os.environ.get('PIXIV_REFRESH_TOKEN')
    if not refresh_token:
        print("Error: PIXIV_REFRESH_TOKEN 环境变量未设置")
        sys.exit(1)
        
    try:
        api.auth(refresh_token=refresh_token)
        if fetch_artwork(api, artwork_id, exclude_images):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"认证或获取作品时发生错误: {e}")
        sys.exit(1) 