import {
  HandLandmarker,
  HandLandmarkerResult,
  FilesetResolver,
  GestureRecognizer,
  GestureRecognizerResult
} from '@mediapipe/tasks-vision';

// MediaPipeモデルのパス
// CDN URLを使用
const HAND_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const GESTURE_RECOGNIZER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

// 異なるジェスチャーの種類
export type HandGesture = 'none' | 'fist' | 'pointing' | 'open_hand' | 'peace' | 'thumbs_up' | 'ok' | 'rock' | 'unknown';

// 初期化状態を追跡
let handLandmarker: HandLandmarker | null = null;
let gestureRecognizer: GestureRecognizer | null = null;
let isInitializing = false;
let initPromise: Promise<boolean> | null = null;

/**
 * MediaPipeのWASMをロードするためのヘルパー関数
 */
async function loadWasmFiles(): Promise<boolean> {
  try {
    // WASMファイルをキャッシュから強制的に更新
    const cacheStorages = await (window as any).caches?.keys();
    if (cacheStorages) {
      for (const cacheName of cacheStorages) {
        if (cacheName.includes('mediapipe') || cacheName.includes('vision-wasm')) {
          await (window as any).caches.delete(cacheName);
          console.log(`キャッシュを削除しました: ${cacheName}`);
        }
      }
    }
    
    // WASMファイルを先にプリロード
    const wasmUrls = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_nosimd_internal.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_nosimd_internal.wasm'
    ];
    
    console.log('MediaPipe WASMファイルをプリロード中...');
    const preloadPromises = wasmUrls.map(url => 
      fetch(url, { cache: 'no-cache' }).then(res => {
        if (!res.ok) throw new Error(`Failed to preload: ${url}, status: ${res.status}`);
        console.log(`プリロード成功: ${url}`);
        return res;
      }).catch(err => {
        console.warn(`プリロード失敗 (無視可): ${url}`, err);
        return null;
      })
    );
    
    await Promise.all(preloadPromises);
    return true;
  } catch (error) {
    console.warn('WASM プリロードエラー (無視可):', error);
    return true; // エラーでも続行
  }
}

/**
 * MediaPipeハンドトラッキングを初期化します
 */
export async function initializeMediaPipeHandTracking(): Promise<boolean> {
  if (handLandmarker && gestureRecognizer) return true;
  if (isInitializing) return initPromise as Promise<boolean>;
  
  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('MediaPipe Hand Tracking を初期化中...');
      
      // WASMファイルを先にプリロード
      await loadWasmFiles();
      
      // MediaPipeの依存関係を解決
      console.log('Vision dependencies を解決中...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      
      console.log('Vision dependency resolved, loading HandLandmarker model...');
      
      // HandLandmarkerを初期化（エラーハンドリングを強化）
      try {
        console.log('HandLandmarker モデルをロード中...', HAND_LANDMARKER_MODEL_URL);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        console.log('HandLandmarker loaded successfully');
      } catch (handError) {
        console.error('HandLandmarker GPU初期化エラー:', handError);
        // GPUが利用できない場合はCPUで試す
        try {
          console.log('CPU fallback: HandLandmarker モデルをロード中...');
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: HAND_LANDMARKER_MODEL_URL,
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
          });
          console.log('HandLandmarker loaded with CPU fallback');
        } catch (fallbackError) {
          console.error('HandLandmarker CPU fallback failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      console.log('Loading GestureRecognizer model...');
      
      // GestureRecognizerを初期化（オプション）
      try {
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2
        });
        console.log('GestureRecognizer loaded successfully');
      } catch (gestureError) {
        console.warn('GestureRecognizer初期化スキップ（オプション機能）:', gestureError);
        // GestureRecognizerは必須ではないため、失敗しても続行
      }
      
      console.log('MediaPipe Hand Tracking 初期化完了');
      return true;
    } catch (error) {
      console.error('MediaPipe Hand Tracking 初期化エラー:', error);
      return false;
    } finally {
      isInitializing = false;
    }
  })();
  
  return initPromise;
}

/**
 * 画像/ビデオから手のランドマークを検出します
 */
export async function detectHandLandmarks(
  source: HTMLVideoElement | HTMLImageElement | ImageData,
  timestamp?: number
): Promise<HandLandmarkerResult | null> {
  try {
    if (!handLandmarker) {
      const initialized = await initializeMediaPipeHandTracking();
      if (!initialized) return null;
    }
    
    // 異なる入力タイプに対応
    if (source instanceof HTMLVideoElement) {
      return handLandmarker!.detectForVideo(source, timestamp || performance.now());
    } else if (source instanceof HTMLImageElement) {
      return handLandmarker!.detect(source);
    } else {
      return handLandmarker!.detect(source);
    }
  } catch (error) {
    console.error('手のランドマーク検出エラー:', error);
    return null;
  }
}

/**
 * 画像/ビデオからジェスチャーを認識します
 */
export async function recognizeGesture(
  source: HTMLVideoElement | HTMLImageElement | ImageData,
  timestamp?: number
): Promise<GestureRecognizerResult | null> {
  try {
    if (!gestureRecognizer) {
      const initialized = await initializeMediaPipeHandTracking();
      if (!initialized) return null;
    }
    
    // 異なる入力タイプに対応
    if (source instanceof HTMLVideoElement) {
      return gestureRecognizer!.recognizeForVideo(source, timestamp || performance.now());
    } else if (source instanceof HTMLImageElement) {
      return gestureRecognizer!.recognize(source);
    } else {
      return gestureRecognizer!.recognize(source);
    }
  } catch (error) {
    console.error('ジェスチャー認識エラー:', error);
    return null;
  }
}

/**
 * ランドマークデータからジェスチャーを解析します（GestureRecognizerがない場合のフォールバック）
 */
export function analyzeHandGesture(result: HandLandmarkerResult): HandGesture[] {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return ['none'];
  }
  
  return result.landmarks.map(landmarks => {
    // 指が立っているかどうかを確認するヘルパー関数
    const isFingerExtended = (fingertipIdx: number, middleJointIdx: number, baseIdx: number = 0): boolean => {
      const fingertip = landmarks[fingertipIdx];
      const middleJoint = landmarks[middleJointIdx];
      const wrist = landmarks[baseIdx];
      
      // 指先が手首から十分に離れているかチェック
      const distFingertipToWrist = distance(fingertip, wrist);
      const distMiddleToWrist = distance(middleJoint, wrist);
      
      return distFingertipToWrist > distMiddleToWrist * 1.2;
    };
    
    // 各指が立っているかチェック
    const thumbExtended = isFingerExtended(4, 2);
    const indexExtended = isFingerExtended(8, 6);
    const middleExtended = isFingerExtended(12, 10);
    const ringExtended = isFingerExtended(16, 14);
    const pinkyExtended = isFingerExtended(20, 18);
    
    // 親指と人差し指が近いかチェック (OKサイン)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const isThumbIndexClose = distance(thumbTip, indexTip) < 0.07;
    
    // ジェスチャー判定
    if (isThumbIndexClose && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'ok';
    } else if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'thumbs_up';
    } else if (!thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'pointing';
    } else if (!thumbExtended && indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return 'peace';
    } else if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'fist';
    } else if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return 'open_hand';
    } else if (!thumbExtended && indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
      return 'rock';
    }
    
    return 'unknown';
  });
}

/**
 * 2点間の距離を計算
 */
function distance(a: {x: number, y: number, z: number}, b: {x: number, y: number, z: number}): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + 
    Math.pow(a.y - b.y, 2) + 
    Math.pow(a.z - b.z, 2)
  );
}

/**
 * リソースを解放
 */
export function disposeMediaPipeHandTracking(): void {
  if (handLandmarker) {
    try {
      handLandmarker.close();
    } catch (err) {
      console.warn('HandLandmarkerのクローズ中にエラーが発生しました:', err);
    } finally {
      handLandmarker = null;
    }
  }
  
  if (gestureRecognizer) {
    try {
      gestureRecognizer.close();
    } catch (err) {
      console.warn('GestureRecognizerのクローズ中にエラーが発生しました:', err);
    } finally {
      gestureRecognizer = null;
    }
  }
  
  isInitializing = false;
  initPromise = null;
}