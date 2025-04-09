interface ArtworkData {
  id: number;
  title?: string;
  page_count: number;
  images?: string[];
}

// 定义函数类型
type GetOSSPathFunc = (path: string) => string;
type GetArtworkPathFunc = (id: string, filename: string, format: 'jpg' | 'webp') => string;

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
  private getOSSPath: GetOSSPathFunc = () => '';  // 提供默认空函数作为初始值
  private getArtworkPath: GetArtworkPathFunc = () => '';

  // 用于存储事件监听器引用，以便移除
  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private handleMouseMoveEdge: ((e: MouseEvent) => void) | null = null;
  private handleMouseMoveTrack: ((e: MouseEvent) => void) | null = null;
  private handleClickPrev: (() => void) | null = null;
  private handleClickNext: (() => void) | null = null;

  constructor(getOSSPathFunc: GetOSSPathFunc, getArtworkPathFunc: GetArtworkPathFunc) {
    // 确保在客户端环境中执行
    if (typeof window === 'undefined') return;

    // 保存传入的函数
    this.getOSSPath = getOSSPathFunc;
    this.getArtworkPath = getArtworkPathFunc;

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
    }

    // 只有在需要多页切换功能时才检查相关元素
    if (this.totalImages > 1) {
      if (!this.prevImageBtn || !this.nextImageBtn || !this.imageCounter) {
        return;
      }
    }

    // 基本元素检查
    if (!this.artwork || !this.artworkFrame) {
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

        // 获取主图片容器内的 picture 和 img 元素
        const mainContainer = this.artworkFrame.querySelector('#main-image-container');
        const pictureElement = mainContainer?.querySelector('picture');
        const imgElement = pictureElement?.querySelector('img#artwork-image') as HTMLImageElement | null;
        const webpSourceElement = pictureElement?.querySelector('source[type="image/webp"]') as HTMLSourceElement | null;

        if (!mainContainer || !pictureElement || !imgElement || !webpSourceElement) {
          // 如果关键元素不存在，可能需要回退到创建元素的逻辑（或者报错）
          // 为了简化，这里仅打印错误并退出，实际应用可能需要更健壮的处理
          console.error('无法找到主图片显示所需的元素 (picture, img, source)');
          return; 
        }

        // 获取目标图片的路径
        let targetSrc: string | null = null;
        let targetWebpSrc: string | null = null;

        if (imageIndex === 1 && this.initialFirstImage) {
          targetSrc = this.initialFirstImage;
          targetWebpSrc = targetSrc.replace(/\.jpg$/, '.webp'); // 假设 WebP 路径对应
        } else {
          // 使用传入的 this.getOSSPath 和 this.getArtworkPath
          const preloadedPicture = document.querySelector(`#preloaded-images picture[key="${this.artworkData.id}-${imageIndex}"]`);
          const preloadedImg = preloadedPicture?.querySelector('img') as HTMLImageElement | null;
          const preloadedWebpSource = preloadedPicture?.querySelector('source[type="image/webp"]') as HTMLSourceElement | null;
          
          if (preloadedImg && preloadedWebpSource) {
            targetSrc = preloadedImg.src;
            targetWebpSrc = preloadedWebpSource.srcset; 
          } else {
              // 如果预加载图片没找到，尝试动态生成路径 (作为备选)
              const filename = `${this.artworkData.id}_${imageIndex}.jpg`;
              targetSrc = this.getOSSPath(this.getArtworkPath(this.artworkData.id.toString(), filename, 'jpg'));
              targetWebpSrc = this.getOSSPath(this.getArtworkPath(this.artworkData.id.toString(), filename, 'webp'));
              console.warn(`图片 ${imageIndex} 未在预加载区域找到，动态生成路径。`);
          }
        }

        if (!targetSrc || !targetWebpSrc) {
          throw new Error(`无法确定图片 ${imageIndex} 的源路径`);
        }

        // --- 优化：更新现有元素的属性 --- 
        imgElement.src = targetSrc; 
        imgElement.alt = this.artworkData.title || `图片 ${imageIndex}`; 
        imgElement.dataset.index = imageIndex.toString();
        
        webpSourceElement.srcset = targetWebpSrc;

        // 图片加载完成后更新按钮状态可能更平滑，但这里保持原逻辑
        this.updateImageButtons();

      } catch (error) {
        console.error('更新图片时出错:', error);
        // 发生错误时可以考虑重置或显示错误信息
        // this.currentImageIndex = 0;
        // this.updateImageButtons();
      }
    }
  }

  private bindEvents() {
    // 保存监听器引用
    this.handleClickPrev = () => {
      if (this.currentImageIndex > 0) {
        this.currentImageIndex--;
        this.updateImage();
        // this.updateImageButtons(); // updateImage 内部会调用
      }
    };
    this.handleClickNext = () => {
      if (this.currentImageIndex < this.totalImages - 1) {
        this.currentImageIndex++;
        this.updateImage();
        // this.updateImageButtons(); // updateImage 内部会调用
      }
    };

    this.prevImageBtn?.addEventListener('click', this.handleClickPrev);
    this.nextImageBtn?.addEventListener('click', this.handleClickNext);

    this.handleKeyDown = (e: KeyboardEvent) => {
      const prevArtworkLink = document.querySelector('.artwork-nav-left a') as HTMLAnchorElement;
      const nextArtworkLink = document.querySelector('.artwork-nav-right a') as HTMLAnchorElement;

      if (e.key === 'ArrowLeft') {
        if (this.totalImages > 1 && this.currentImageIndex > 0) {
          this.prevImageBtn?.click();
        } else if (prevArtworkLink) {
          prevArtworkLink.click(); // 触发 Astro View Transitions 导航
        }
      } else if (e.key === 'ArrowRight') {
        if (this.totalImages > 1 && this.currentImageIndex < this.totalImages - 1) {
          this.nextImageBtn?.click();
        } else if (nextArtworkLink) {
          nextArtworkLink.click(); // 触发 Astro View Transitions 导航
        }
      }
    };
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private setupEdgeDetection() {
    const navLeft = document.querySelector('.artwork-nav-left');
    const navRight = document.querySelector('.artwork-nav-right');
    const prevButton = navLeft?.querySelector('.artwork-nav-button') as HTMLElement;
    const nextButton = navRight?.querySelector('.artwork-nav-button') as HTMLElement;
    
    // 保存监听器引用
    this.handleMouseMoveEdge = (e: MouseEvent) => {
      const x = e.clientX;
      const windowWidth = window.innerWidth;
      if (x < 100) {
        if (prevButton) { navLeft?.classList.add('show'); prevButton.style.cursor = 'pointer'; }
      } else {
        navLeft?.classList.remove('show');
        if (prevButton) { prevButton.style.cursor = 'default'; }
      }
      if (x > windowWidth - 100) {
        if (nextButton) { navRight?.classList.add('show'); nextButton.style.cursor = 'pointer'; }
      } else {
        navRight?.classList.remove('show');
        if (nextButton) { nextButton.style.cursor = 'default'; }
      }
    };
    document.addEventListener('mousemove', this.handleMouseMoveEdge);
  }

  private setupMouseTracking() {
    // 保存监听器引用
    this.handleMouseMoveTrack = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mouse-x', `${x}%`);
      document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    };
    document.addEventListener('mousemove', this.handleMouseMoveTrack);
  }

  // 新增 destroy 方法
  public destroy() {
    console.log('Destroying ArtworkManager instance and listeners');
    // 移除按钮监听器
    if (this.handleClickPrev) {
      this.prevImageBtn?.removeEventListener('click', this.handleClickPrev);
    }
    if (this.handleClickNext) {
      this.nextImageBtn?.removeEventListener('click', this.handleClickNext);
    }
    // 移除 document 监听器
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
    if (this.handleMouseMoveEdge) {
      document.removeEventListener('mousemove', this.handleMouseMoveEdge);
    }
    if (this.handleMouseMoveTrack) {
      document.removeEventListener('mousemove', this.handleMouseMoveTrack);
    }
    // 清理引用
    this.handleKeyDown = null;
    this.handleMouseMoveEdge = null;
    this.handleMouseMoveTrack = null;
    this.handleClickPrev = null;
    this.handleClickNext = null;
    // 可选：重置其他状态或引用，虽然实例将被丢弃
    this.artwork = null;
    this.artworkFrame = null;
    // ... etc
  }
}

// 移除 declare function，因为函数现在作为参数传入
// declare function getOSSPath(path: string): string;
// declare function getArtworkPath(id: string, filename: string, format: 'jpg' | 'webp'): string; 