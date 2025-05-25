/**
 * OpenCV.js Tracker for Person Tracking
 * Provides continuous tracking using CSRT tracker
 */

interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

declare global {
  interface Window {
    cv: any;
    _opencvLoading?: boolean;
    _opencvLoaded?: boolean;
  }
}

export class OpenCVTracker {
  private tracker: any = null;
  private isInitialized = false;
  private isTracking = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * OpenCV.jsを初期化
   */
  async initialize(): Promise<boolean> {
    try {
      // 既に初期化済みの場合
      if (this.isInitialized && window.cv && window.cv.getBuildInformation) {
        console.log('✅ OpenCV.js already initialized');
        return true;
      }

      // OpenCV.jsをCDNから読み込み（重複防止）
      if (!window.cv || !window.cv.getBuildInformation) {
        await this.loadOpenCV();
      }

      // OpenCVが使用可能か確認
      if (window.cv && window.cv.getBuildInformation) {
        console.log('✅ OpenCV.js initialized successfully');
        console.log('OpenCV.js version:', window.cv.getBuildInformation());
        this.isInitialized = true;
        window._opencvLoaded = true;
        return true;
      } else {
        console.error('❌ OpenCV.js not properly loaded');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize OpenCV.js:', error);
      window._opencvLoading = false;
      return false;
    }
  }

  /**
   * OpenCV.jsをCDNから動的読み込み（重複防止）
   */
  private loadOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 既に読み込まれている場合
      if (window._opencvLoaded && window.cv && window.cv.getBuildInformation) {
        console.log('✅ OpenCV.js already loaded');
        resolve();
        return;
      }

      // 読み込み中の場合は待機
      if (window._opencvLoading) {
        console.log('⏳ OpenCV.js loading in progress, waiting...');
        const checkLoaded = () => {
          if (window._opencvLoaded && window.cv && window.cv.getBuildInformation) {
            resolve();
          } else if (!window._opencvLoading) {
            reject(new Error('OpenCV.js loading failed'));
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
        return;
      }

      // 既存のスクリプトタグをチェック
      const existingScript = document.querySelector('script[src*="opencv.js"]');
      if (existingScript) {
        console.log('📦 OpenCV.js script already exists, waiting for load...');
        window._opencvLoading = true;
        
        const checkReady = () => {
          if (window.cv && window.cv.getBuildInformation) {
            console.log('📦 OpenCV.js loaded and ready');
            window._opencvLoading = false;
            window._opencvLoaded = true;
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
        return;
      }

      // 新しいスクリプトタグを作成
      console.log('📦 Loading OpenCV.js from CDN...');
      window._opencvLoading = true;
      
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
      script.async = true;
      script.id = 'opencv-js-script'; // IDを追加して識別しやすく
      
      script.onload = () => {
        console.log('📦 OpenCV.js script loaded, waiting for initialization...');
        // OpenCVの初期化を待つ
        const checkReady = () => {
          if (window.cv && window.cv.getBuildInformation) {
            console.log('📦 OpenCV.js loaded and ready');
            window._opencvLoading = false;
            window._opencvLoaded = true;
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      };
      
      script.onerror = () => {
        console.error('❌ Failed to load OpenCV.js script');
        window._opencvLoading = false;
        reject(new Error('Failed to load OpenCV.js'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * トラッキングを開始
   */
  startTracking(video: HTMLVideoElement, roi: ROI): boolean {
    if (!this.isInitialized || !window.cv) {
      console.error('❌ OpenCV.js not initialized');
      return false;
    }

    try {
      // 既存のトラッカーを破棄
      if (this.tracker) {
        try {
          this.tracker.delete();
        } catch (e) {
          console.warn('⚠️ Error deleting previous tracker:', e);
        }
        this.tracker = null;
      }

      // CSRTトラッカーを作成（エラーハンドリング強化）
      try {
        if (window.cv.TrackerCSRT) {
          this.tracker = new window.cv.TrackerCSRT();
        } else if (window.cv.legacy && window.cv.legacy.TrackerCSRT) {
          this.tracker = new window.cv.legacy.TrackerCSRT();
        } else {
          console.error('❌ CSRT Tracker not available in this OpenCV build');
          return false;
        }
      } catch (trackerError) {
        console.error('❌ Failed to create CSRT tracker:', trackerError);
        return false;
      }

      // ビデオフレームをMatに変換
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
      this.ctx.drawImage(video, 0, 0);
      
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const mat = window.cv.matFromImageData(imageData);

      // ROIを設定
      const rect = new window.cv.Rect(
        Math.round(roi.x), 
        Math.round(roi.y), 
        Math.round(roi.width), 
        Math.round(roi.height)
      );

      // ROIの境界チェック
      if (rect.x < 0 || rect.y < 0 || 
          rect.x + rect.width > this.canvas.width || 
          rect.y + rect.height > this.canvas.height) {
        console.warn('⚠️ ROI is out of bounds, adjusting...');
        rect.x = Math.max(0, Math.min(rect.x, this.canvas.width - rect.width));
        rect.y = Math.max(0, Math.min(rect.y, this.canvas.height - rect.height));
        rect.width = Math.min(rect.width, this.canvas.width - rect.x);
        rect.height = Math.min(rect.height, this.canvas.height - rect.y);
      }

      // トラッカー初期化
      const success = this.tracker.init(mat, rect);
      
      if (success) {
        this.isTracking = true;
        console.log('🎯 OpenCV tracker started successfully:', {
          x: rect.x, y: rect.y, width: rect.width, height: rect.height
        });
      } else {
        console.error('❌ Failed to initialize tracker');
      }

      // メモリクリーンアップ
      try {
        mat.delete();
        rect.delete();
      } catch (cleanupError) {
        console.warn('⚠️ Error during cleanup:', cleanupError);
      }

      return success;
    } catch (error) {
      console.error('❌ Error starting tracker:', error);
      return false;
    }
  }

  /**
   * トラッキングを更新
   */
  updateTracking(video: HTMLVideoElement): ROI | null {
    if (!this.isTracking || !this.tracker || !window.cv) {
      return null;
    }

    try {
      // ビデオフレームをMatに変換
      this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const mat = window.cv.matFromImageData(imageData);

      // トラッキング更新
      const rect = new window.cv.Rect();
      let success = false;
      
      try {
        success = this.tracker.update(mat, rect);
      } catch (updateError) {
        console.error('❌ Tracker update failed:', updateError);
        this.isTracking = false;
        
        // メモリクリーンアップ
        try {
          mat.delete();
          rect.delete();
        } catch (e) {
          console.warn('⚠️ Cleanup error:', e);
        }
        return null;
      }

      let result: ROI | null = null;
      
      if (success && rect.width > 0 && rect.height > 0) {
        result = {
          x: Math.max(0, Math.round(rect.x)),
          y: Math.max(0, Math.round(rect.y)),
          width: Math.min(Math.round(rect.width), this.canvas.width - Math.round(rect.x)),
          height: Math.min(Math.round(rect.height), this.canvas.height - Math.round(rect.y))
        };
        
        // 結果の検証
        if (result.width <= 0 || result.height <= 0) {
          console.warn('⚠️ Invalid tracking result, stopping tracker');
          this.isTracking = false;
          result = null;
        } else {
          console.log('🎯 Tracking updated:', result);
        }
      } else {
        console.warn('⚠️ Tracking lost');
        this.isTracking = false;
      }

      // メモリクリーンアップ
      try {
        mat.delete();
        rect.delete();
      } catch (cleanupError) {
        console.warn('⚠️ Error during cleanup:', cleanupError);
      }

      return result;
    } catch (error) {
      console.error('❌ Error updating tracker:', error);
      this.isTracking = false;
      return null;
    }
  }

  /**
   * トラッキングを停止
   */
  stopTracking(): void {
    if (this.tracker) {
      try {
        this.tracker.delete();
        this.tracker = null;
      } catch (error) {
        console.warn('⚠️ Error deleting tracker:', error);
      }
    }
    this.isTracking = false;
    console.log('🛑 Tracking stopped');
  }

  /**
   * トラッキング状態を取得
   */
  getTrackingStatus(): { initialized: boolean; tracking: boolean } {
    return {
      initialized: this.isInitialized,
      tracking: this.isTracking
    };
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.stopTracking();
    this.isInitialized = false;
    console.log('🗑️ OpenCV tracker disposed');
  }
} 