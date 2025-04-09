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
  private imageWrapper: HTMLDivElement | null = null; // 新增：图片容器引用
  private mainImageElement: HTMLImageElement | null = null; // 新增：主图片引用
  private handleImageLoadOrError: (() => void) | null = null; // 新增：加载完成/失败的处理器

  // 用于存储事件监听器引用，以便移除
  private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private handleMouseMoveEdge: ((e: MouseEvent) => void) | null = null;
  private handleMouseMoveTrack: ((e: MouseEvent) => void) | null = null;
  private handleClickPrev: (() => void) | null = null;
  private handleClickNext: (() => void) | null = null;

  constructor(getOSSPathFunc: GetOSSPathFunc, getArtworkPathFunc: GetArtworkPathFunc) {
    if (typeof window === 'undefined') return;

    // 保存传入的函数
    this.getOSSPath = getOSSPathFunc;
    this.getArtworkPath = getArtworkPathFunc;

    this.artwork = document.querySelector('#artwork-container');
    this.artworkFrame = document.querySelector('#artwork-frame');
    this.imageWrapper = this.artworkFrame?.querySelector('.artwork-image-wrapper') ?? null; 
    this.mainImageElement = this.imageWrapper?.querySelector('#artwork-image') ?? null;
    
    this.prevImageBtn = document.querySelector('#prev-image');
    this.nextImageBtn = document.querySelector('#next-image');
    this.imageCounter = document.querySelector('#image-counter');
    this.artworkData = this.artwork ? JSON.parse(this.artwork.dataset.artwork || '{}') : { id: 0, page_count: 1 };
    this.totalImages = this.artworkData.page_count || 1;

    const firstImage = this.mainImageElement; // 使用已获取的引用
    if (firstImage) {
      this.initialFirstImage = firstImage.src;
    }

    // 只有在需要多页切换功能时才检查相关元素
    if (this.totalImages > 1) {
      if (!this.prevImageBtn || !this.nextImageBtn || !this.imageCounter) {
        // console.error("ArtworkManager: Missing multi-image navigation elements."); // 移除或保留
        // return; // 可能允许只显示第一张图？根据需求决定
      }
    }

    // 基本元素检查
    if (!this.artwork || !this.artworkFrame || !this.imageWrapper || !this.mainImageElement) { 
        // console.error("ArtworkManager: Missing critical elements (artwork, frame, wrapper, or main image)."); // 移除或保留
        return;
    }

    this.init();
  }

  private init() {
    this.bindEvents();
    this.updateImageButtons();
    this.setupEdgeDetection();
    this.setupMouseTracking();
    this.setupImageLoadingListener();
  }

  private updateImageButtons() {
    if (this.prevImageBtn && this.nextImageBtn && this.imageCounter) {
      this.prevImageBtn.disabled = this.currentImageIndex === 0;
      this.nextImageBtn.disabled = this.currentImageIndex === this.totalImages - 1;
      this.imageCounter.textContent = `${this.currentImageIndex + 1} / ${this.totalImages}`;
    }
  }

  private async updateImage() {
    if (this.artworkFrame && this.imageWrapper && this.mainImageElement && this.artworkData.id) {
      try {
        const imageIndex = this.currentImageIndex + 1;
        
        const mainContainer = this.artworkFrame.querySelector('#main-image-container');
        const pictureElement = mainContainer?.querySelector('picture');
        const imgElement = this.mainImageElement;
        const webpSourceElement = pictureElement?.querySelector('source[type="image/webp"]') as HTMLSourceElement | null;

        if (!mainContainer || !pictureElement || !imgElement || !webpSourceElement) {
          // console.error('无法找到主图片显示所需的元素 (picture, img, source)'); // 移除或保留
          return;
        }

        let targetSrc: string | null = null;
        let targetWebpSrc: string | null = null;

        if (imageIndex === 1 && this.initialFirstImage) {
          targetSrc = this.initialFirstImage;
          targetWebpSrc = targetSrc.replace(/\.jpg$/, '.webp');
        } else {
          // --- 修改：使用 data-index 查找预加载图片 --- 
          const preloadedImg = document.querySelector(`#preloaded-images img[data-index="${imageIndex}"]`) as HTMLImageElement | null;
          
          if (preloadedImg) {
            targetSrc = preloadedImg.src;
            // 尝试找到对应的 picture 和 source 来获取 webp srcset
            const preloadedPicture = preloadedImg.closest('picture');
            const preloadedWebpSource = preloadedPicture?.querySelector('source[type="image/webp"]') as HTMLSourceElement | null;
            if (preloadedWebpSource) {
              targetWebpSrc = preloadedWebpSource.srcset;
            } else {
              // 如果找不到 source，回退到基于 src 的假设
              targetWebpSrc = targetSrc.replace(/\.jpg$/, '.webp');
              // console.warn(`图片 ${imageIndex} 的 WebP source 未找到，根据 jpg src 推断。`); // 移除
            }
          } else {
              // 如果预加载图片没找到，动态生成路径 (作为备选)
              const filename = `${this.artworkData.id}_${imageIndex}.jpg`;
              targetSrc = this.getOSSPath(this.getArtworkPath(this.artworkData.id.toString(), filename, 'jpg'));
              targetWebpSrc = this.getOSSPath(this.getArtworkPath(this.artworkData.id.toString(), filename, 'webp'));
              // console.warn(`图片 ${imageIndex} 未在预加载区域找到，动态生成路径。`); // 移除
          }
        }

        if (!targetSrc || !targetWebpSrc) {
          throw new Error(`无法确定图片 ${imageIndex} 的源路径`);
        }

        imgElement.src = targetSrc; 
        imgElement.alt = this.artworkData.title || `图片 ${imageIndex}`; 
        imgElement.dataset.index = imageIndex.toString();
        webpSourceElement.srcset = targetWebpSrc;

      } catch (error) {
        console.error('更新图片时出错:', error);
      }
    } else {
        // console.error("updateImage called but critical elements are missing."); // 移除或保留
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

  // 新增方法：设置图片加载监听器
  private setupImageLoadingListener() {
      if (!this.mainImageElement || !this.imageWrapper) return;
      
      this.handleImageLoadOrError = () => {
          this.updateImageButtons();
      };
      
      this.mainImageElement.addEventListener('load', this.handleImageLoadOrError);
      this.mainImageElement.addEventListener('error', this.handleImageLoadOrError);
  }

  // 新增 destroy 方法
  public destroy() {
    // console.log('Destroying ArtworkManager instance and listeners'); // 移除
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
    // 移除图片加载监听器
    if (this.handleImageLoadOrError && this.mainImageElement) {
        this.mainImageElement.removeEventListener('load', this.handleImageLoadOrError);
        this.mainImageElement.removeEventListener('error', this.handleImageLoadOrError);
    }
    // 清理引用
    this.handleKeyDown = null;
    this.handleMouseMoveEdge = null;
    this.handleMouseMoveTrack = null;
    this.handleClickPrev = null;
    this.handleClickNext = null;
    this.handleImageLoadOrError = null; // 清理新处理器引用
    this.artwork = null;
    this.artworkFrame = null;
    this.imageWrapper = null; // 清理新引用
    this.mainImageElement = null; // 清理新引用
  }
}

// 移除 declare function，因为函数现在作为参数传入
// declare function getOSSPath(path: string): string;
// declare function getArtworkPath(id: string, filename: string, format: 'jpg' | 'webp'): string; 