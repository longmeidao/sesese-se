interface ArtworkData {
  id: number;
  title?: string;
  page_count: number;
  images?: string[];
}

export class ArtworkManager {
  private currentImageIndex: number = 0;
  private artwork: HTMLDivElement | null = null;
  private artworkFrame: HTMLDivElement | null = null;
  private prevImageBtn: HTMLButtonElement | null = null;
  private nextImageBtn: HTMLButtonElement | null = null;
  private imageCounter: HTMLElement | null = null;
  private artworkData: ArtworkData = { id: 0, page_count: 1 };
  private totalImages: number = 1;
  private initialFirstImage: string | null = null;  // 存储初始第一张图片的路径

  constructor() {
    // 确保在客户端环境中执行
    if (typeof window === 'undefined') return;

    this.artwork = document.querySelector('#artwork-container');
    this.artworkFrame = document.querySelector('#artwork-frame');
    this.prevImageBtn = document.querySelector('#prev-image');
    this.nextImageBtn = document.querySelector('#next-image');
    this.imageCounter = document.querySelector('#image-counter');
    this.artworkData = this.artwork ? JSON.parse(this.artwork.dataset.artwork || '{}') : { id: 0, page_count: 1 };
    this.totalImages = this.artworkData.page_count || 1;

    // 保存初始第一张图片的路径
    const firstImage = document.querySelector('#artwork-image') as HTMLImageElement;
    if (firstImage) {
      this.initialFirstImage = firstImage.src;
      console.log('Initial first image path saved:', this.initialFirstImage);
    }

    console.log('ArtworkManager initialized:', {
      artworkData: this.artworkData,
      totalImages: this.totalImages
    });

    // 只有在需要多页切换功能时才检查相关元素
    if (this.totalImages > 1) {
      if (!this.prevImageBtn || !this.nextImageBtn || !this.imageCounter) {
        console.warn('Multi-page navigation elements not found');
        return;
      }
    }

    // 基本元素检查
    if (!this.artwork || !this.artworkFrame) {
      console.warn('Basic artwork elements not found');
      return;
    }

    this.init();
  }

  private init() {
    this.bindEvents();
    this.updateImageButtons();
    this.setupEdgeDetection();
    this.setupMouseTracking();
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
        console.log('Updating image:', {
          currentIndex: this.currentImageIndex,
          imageIndex,
          totalImages: this.totalImages
        });

        // 获取主图片容器
        const mainContainer = document.querySelector('#main-image-container');
        if (!mainContainer) {
          console.error('Main image container not found');
          throw new Error('无法找到主图片容器');
        }

        // 获取目标图片
        let targetImage: HTMLImageElement | null = null;
        let targetSrc: string | null = null;
        
        if (imageIndex === 1 && this.initialFirstImage) {
          // 如果是切换回第一张图片，使用保存的初始路径
          console.log('Using initial first image:', this.initialFirstImage);
          targetSrc = this.initialFirstImage;
        } else {
          // 从预加载区域查找目标图片
          const preloadedImages = document.querySelectorAll('#preloaded-images img') as NodeListOf<HTMLImageElement>;
          console.log('Preloaded images count:', preloadedImages.length);

          // 遍历所有预加载的图片
          for (const img of preloadedImages) {
            const imgIndex = img.dataset.index;
            console.log('Checking preloaded image:', {
              index: imgIndex,
              src: img.src
            });
            
            if (imgIndex === imageIndex.toString()) {
              targetSrc = img.src;
              break;
            }
          }
        }

        if (!targetSrc) {
          console.error('Target image not found:', {
            imageIndex,
            artworkId: this.artworkData.id
          });
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
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.src = targetSrc;
        img.dataset.index = imageIndex.toString();
        
        console.log('New image element created:', {
          id: img.id,
          src: img.src,
          index: img.dataset.index
        });

        // 清空并更新主图片容器
        mainContainer.innerHTML = '';
        mainContainer.appendChild(img);

        // 更新按钮状态
        this.updateImageButtons();
      } catch (error) {
        console.error('Error updating image:', error);
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
    const prevButton = navLeft?.querySelector('.artwork-nav-button') as HTMLElement;
    const nextButton = navRight?.querySelector('.artwork-nav-button') as HTMLElement;
    
    document.addEventListener('mousemove', (e) => {
      const x = e.clientX;
      const windowWidth = window.innerWidth;
      
      if (x < 100) {
        if (prevButton) {
          navLeft?.classList.add('show');
          prevButton.style.cursor = 'pointer';
        }
      } else {
        navLeft?.classList.remove('show');
        if (prevButton) {
          prevButton.style.cursor = 'default';
        }
      }
      
      if (x > windowWidth - 100) {
        if (nextButton) {
          navRight?.classList.add('show');
          nextButton.style.cursor = 'pointer';
        }
      } else {
        navRight?.classList.remove('show');
        if (nextButton) {
          nextButton.style.cursor = 'default';
        }
      }
    });
  }

  private setupMouseTracking() {
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mouse-x', `${x}%`);
      document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    });
  }
} 