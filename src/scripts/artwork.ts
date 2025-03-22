interface ArtworkData {
  id: number;
  title?: string;
  page_count: number;
  images?: string[];
}

export class ArtworkManager {
  private currentImageIndex: number = 0;
  private artwork: HTMLDivElement;
  private artworkFrame: HTMLDivElement;
  private prevImageBtn: HTMLButtonElement;
  private nextImageBtn: HTMLButtonElement;
  private imageCounter: HTMLElement;
  private artworkData: ArtworkData;
  private totalImages: number;

  constructor() {
    this.artwork = document.querySelector('#artwork-container') as HTMLDivElement;
    this.artworkFrame = document.querySelector('#artwork-frame') as HTMLDivElement;
    this.prevImageBtn = document.querySelector('#prev-image') as HTMLButtonElement;
    this.nextImageBtn = document.querySelector('#next-image') as HTMLButtonElement;
    this.imageCounter = document.querySelector('#image-counter') as HTMLElement;
    this.artworkData = this.artwork ? JSON.parse(this.artwork.dataset.artwork || '{}') : {};
    this.totalImages = this.artworkData.page_count || 1;

    this.init();
  }

  private init() {
    this.bindEvents();
    this.updateImageButtons();
    this.setupEdgeDetection();
  }

  private updateImageButtons() {
    if (this.prevImageBtn && this.nextImageBtn && this.imageCounter) {
      this.prevImageBtn.disabled = this.currentImageIndex === 0;
      this.nextImageBtn.disabled = this.currentImageIndex === this.totalImages - 1;
      this.imageCounter.textContent = `${this.currentImageIndex + 1} / ${this.totalImages}`;
    }
  }

  private async updateImage() {
    if (this.artworkFrame && this.artworkData.id) {
      try {
        const imageIndex = this.currentImageIndex + 1;

        // 获取主图片容器
        const mainContainer = document.querySelector('#main-image-container');
        if (!mainContainer) {
          throw new Error('无法找到主图片容器');
        }

        // 获取目标图片
        let targetImage: HTMLImageElement | null = null;
        
        if (imageIndex === 1) {
          // 对于第一张图片，直接使用当前显示的图片路径
          const currentImage = mainContainer.querySelector('#artwork-image') as HTMLImageElement;
          if (currentImage) {
            // 从当前图片路径中提取基础路径并替换图片序号为 1
            const firstImageSrc = currentImage.src.replace(/_\d+\.jpg/, '_1.jpg');
            
            // 创建临时图片元素来存储路径
            targetImage = document.createElement('img');
            targetImage.src = firstImageSrc;
          } else {
            // 如果找不到当前图片，尝试在预加载区域查找
            targetImage = document.querySelector('#preloaded-images img[src*="_1.jpg"]') as HTMLImageElement;
          }
        } else {
          // 对于其他图片，在预加载区域查找
          targetImage = document.querySelector(`#preloaded-images img[src*="_${imageIndex}.jpg"]`) as HTMLImageElement;
        }

        if (!targetImage) {
          throw new Error(`无法找到图片 ${imageIndex}`);
        }

        // 创建新的图片元素
        const img = document.createElement('img');
        img.id = 'artwork-image';
        img.alt = this.artworkData.title || `图片 ${imageIndex}`;
        img.width = 800;
        img.height = 600;
        img.loading = 'eager';
        img.decoding = 'sync';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.src = targetImage.src;
        img.dataset.index = imageIndex.toString();
        
        // 清空并更新主图片容器
        mainContainer.innerHTML = '';
        mainContainer.appendChild(img);

        // 更新按钮状态
        this.updateImageButtons();
      } catch (error) {
        // 发生错误时重置为第一张图片
        this.currentImageIndex = 0;
        this.updateImageButtons();
      }
    }
  }

  private bindEvents() {
    // 绑定按钮事件
    this.prevImageBtn?.addEventListener('click', () => {
      if (this.currentImageIndex > 0) {
        this.currentImageIndex--;
        this.updateImage();
        this.updateImageButtons();
      }
    });

    this.nextImageBtn?.addEventListener('click', () => {
      if (this.currentImageIndex < this.totalImages - 1) {
        this.currentImageIndex++;
        this.updateImage();
        this.updateImageButtons();
      }
    });

    // 添加键盘快捷键支持
    document.addEventListener('keydown', (e) => {
      // 获取导航链接
      const prevArtworkLink = document.querySelector('.artwork-nav-left a') as HTMLAnchorElement;
      const nextArtworkLink = document.querySelector('.artwork-nav-right a') as HTMLAnchorElement;

      if (e.key === 'ArrowLeft') {
        // 如果是多页作品且不在第一页，切换到上一页
        if (this.totalImages > 1 && this.currentImageIndex > 0) {
          this.prevImageBtn?.click();
        }
        // 如果是单页作品或在第一页，且存在上一个作品，跳转到上一个作品
        else if (prevArtworkLink) {
          prevArtworkLink.click();
        }
      } else if (e.key === 'ArrowRight') {
        // 如果是多页作品且不在最后一页，切换到下一页
        if (this.totalImages > 1 && this.currentImageIndex < this.totalImages - 1) {
          this.nextImageBtn?.click();
        }
        // 如果是单页作品或在最后一页，且存在下一个作品，跳转到下一个作品
        else if (nextArtworkLink) {
          nextArtworkLink.click();
        }
      }
    });
  }

  private setupEdgeDetection() {
    const navLeft = document.querySelector('.artwork-nav-left');
    const navRight = document.querySelector('.artwork-nav-right');
    
    document.addEventListener('mousemove', (e) => {
      const x = e.clientX;
      const windowWidth = window.innerWidth;
      
      if (x < 100) {
        navLeft?.classList.add('show');
      } else {
        navLeft?.classList.remove('show');
      }
      
      if (x > windowWidth - 100) {
        navRight?.classList.add('show');
      } else {
        navRight?.classList.remove('show');
      }
    });
  }
} 