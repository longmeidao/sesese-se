#!/usr/bin/env python3
"""
Pixiv 作品获取脚本
用于获取指定 ID 的 Pixiv 作品内容和元数据
"""

import os
import sys
import json
import requests
from pixivpy3 import AppPixivAPI

def main(artwork_id):
    """主函数，获取并处理作品"""
    # 初始化 Pixiv API
    api = AppPixivAPI()
    refresh_token = os.environ.get('PIXIV_REFRESH_TOKEN')
    if not refresh_token:
        print("错误: 未找到 PIXIV_REFRESH_TOKEN 环境变量")
        sys.exit(1)
    
    try:
        # 认证
        api.auth(refresh_token=refresh_token)
        
        # 获取作品详情
        print(f"正在获取作品 {artwork_id} 的详细信息...")
        artwork_detail = api.illust_detail(artwork_id)
        if not artwork_detail or not hasattr(artwork_detail, 'illust'):
            print(f"错误: 未找到作品 {artwork_id}")
            sys.exit(1)
        
        illust = artwork_detail.illust
        
        # 创建作品目录
        artwork_dir = "artworks/" + str(artwork_id)
        os.makedirs(artwork_dir, exist_ok=True)
        
        # 下载图片
        image_paths = []
        if hasattr(illust, 'meta_pages') and illust.meta_pages:
            # 多图作品
            print(f"检测到多图作品，共 {len(illust.meta_pages)} 张图片")
            for i, page in enumerate(illust.meta_pages):
                image_url = page.image_urls.original
                print(f"正在下载第 {i+1} 张图片...")
                download_path = download_image(image_url, artwork_dir, f"image_{i+1}.jpg")
                if download_path:
                    image_paths.append(f"artworks/{artwork_id}/image_{i+1}.jpg")
        else:
            # 单图作品
            print("检测到单图作品")
            image_url = illust.meta_single_page.get('original_image_url', illust.image_urls.original)
            print("正在下载图片...")
            download_path = download_image(image_url, artwork_dir, "image_1.jpg")
            if download_path:
                image_paths.append(f"artworks/{artwork_id}/image_1.jpg")
        
        # 保存元数据
        metadata = create_metadata(illust, artwork_id, image_paths)
        save_metadata(metadata, artwork_dir)
        
        print(f"作品 {artwork_id} 获取完成！")
    
    except Exception as e:
        print(f"错误: {str(e)}")
        sys.exit(1)

def download_image(url, directory, filename):
    """下载图片到指定目录"""
    try:
        output_path = os.path.join(directory, filename)
        
        # 创建请求头
        headers = {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # 下载图片
        response = requests.get(url, headers=headers, stream=True)
        response.raise_for_status()
        
        # 保存图片
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        print(f"图片已保存至: {output_path}")
        return output_path
    
    except Exception as e:
        print(f"下载图片失败: {str(e)}")
        return None

def create_metadata(illust, artwork_id, image_paths):
    """创建作品元数据"""
    return {
        "id": int(artwork_id),  # 确保 ID 是数字类型
        "title": illust.title,
        "caption": illust.caption or "",  # 确保 caption 存在
        "author": {
            "id": illust.user.id,
            "name": illust.user.name,
            "account": illust.user.account,
            "profile_image_url": illust.user.profile_image_urls.medium  # 添加作者头像 URL
        },
        "description": illust.caption,
        "tags": [tag.name for tag in illust.tags],
        "create_date": illust.create_date,
        "width": illust.width,
        "height": illust.height,
        "page_count": len(image_paths),  # 添加页数
        "total_view": illust.total_view,
        "total_bookmarks": illust.total_bookmarks,
        "is_bookmarked": illust.is_bookmarked,
        "total_comments": getattr(illust, 'total_comments', 0),
        "is_muted": False,  # 添加是否静音标志
        "images": image_paths
    }

def save_metadata(metadata, directory):
    """保存元数据到 JSON 文件"""
    output_path = os.path.join(directory, "metadata.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"元数据已保存至: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使用方法: python fetch_pixiv.py <artwork_id>")
        sys.exit(1)
    
    main(sys.argv[1]) 