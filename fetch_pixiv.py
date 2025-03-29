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
        'id': artwork.id,
        'title': artwork.title,
        'caption': artwork.caption,
        'create_date': artwork.create_date,
        'tags': [tag.name for tag in artwork.tags],
        'page_count': artwork.page_count,
        'total_view': artwork.total_view,
        'total_bookmarks': artwork.total_bookmarks,
        'is_muted': artwork.is_muted,
        'author': {
            'id': artwork.user.id,
            'name': artwork.user.name,
            'account': artwork.user.account,
            'profile_image_url': artwork.user.profile_image_urls.get('medium')
        },
        'images': []
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
        
        # 创建图片保存目录 - 临时目录，用于下载和处理图片
        images_dir = os.path.join(content_dir, 'images', 'pixiv')
        os.makedirs(images_dir, exist_ok=True)
        
        # 创建作品元数据
        metadata = create_metadata(artwork)
        
        # 下载作者头像
        profile_image_url = metadata['author']['profile_image_url']
        avatar_filename = f"author_{artwork.user.id}.jpg"
        
        # 保存到内容目录
        profile_path = download_file(profile_image_url, images_dir, avatar_filename)
        
        if profile_path:
            # 更新元数据中的头像路径为相对路径
            metadata['author']['profile_image_url'] = f"../images/pixiv/{avatar_filename}"
        
        # 下载作品图片
        if artwork.page_count == 1:
            # 单图
            image_url = artwork.meta_single_page.get('original_image_url')
            if image_url:
                filename = f"{artwork_id}_1.jpg"
                
                # 保存到内容目录
                image_path = download_file(image_url, images_dir, filename)
                
                if image_path:
                    # 添加相对路径到元数据
                    metadata['images'].append(f"../images/pixiv/{filename}")
        else:
            # 多图
            for i, image in enumerate(artwork.meta_pages):
                # 检查是否在排除列表中
                if exclude_images and str(i) in exclude_images:
                    continue
                    
                image_url = image.image_urls.get('original')
                if image_url:
                    filename = f"{artwork_id}_{i+1}.jpg"
                    
                    # 保存到内容目录
                    image_path = download_file(image_url, images_dir, filename)
                    
                    if image_path:
                        # 添加相对路径到元数据
                        metadata['images'].append(f"../images/pixiv/{filename}")
                        
                    # 添加随机延迟，避免请求过快
                    time.sleep(random.uniform(1, 2))
            
        # 保存元数据到内容集合目录
        pixiv_content_dir = os.path.join(content_dir, 'pixiv')
        os.makedirs(pixiv_content_dir, exist_ok=True)
        
        # 直接保存为 {id}.json
        json_path = os.path.join(pixiv_content_dir, f"{artwork_id}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            
        print(f"✅ 成功获取并保存作品 {artwork_id}")
        print(f"图片已保存到: {images_dir}")
        
        # 注意：这里不删除图片，让 batch-upload-to-oss.js 在上传完成后删除
        return True
    except Exception as e:
        print(f"处理作品 {artwork_id} 时出错: {e}")
        return False

if __name__ == "__main__":
    # 获取命令行参数中的作品ID和排除图片索引
    if len(sys.argv) < 2:
        print("用法: python fetch_pixiv.py <artwork_id> [exclude_images]")
        sys.exit(1)
        
    artwork_id = sys.argv[1]
    exclude_images = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else None
    
    print(f"准备获取作品ID: {artwork_id}")
    if exclude_images:
        print(f"排除的图片索引: {exclude_images}")
    
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
        print(f"发生错误: {e}")
        sys.exit(1) 