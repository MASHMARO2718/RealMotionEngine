import {
  HandLandmarker,
  HandLandmarkerResult,
  FilesetResolver,
  GestureRecognizer,
  GestureRecognizerResult
} from '@mediapipe/tasks-vision';
import { suppressTensorFlowErrors, restoreConsoleError } from '../utils/error-handling';

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

// タイムスタンプ管理のための変数を追加
let lastTimestamp = 0;

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
  // 既存のインスタンスをクリーンアップ
  if (handLandmarker || gestureRecognizer) {
    try {
      disposeMediaPipeHandTracking();
    } catch (err) {
      console.warn('クリーンアップエラー（無視）:', err);
    }
  }
  
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
          runningMode: 'IMAGE', // 【重要】VIDEO モードではなく IMAGE モードを使用
          numHands: 2,
          minHandDetectionConfidence: 0.3, // 検出感度を高める
          minHandPresenceConfidence: 0.3,  // 検出感度を高める
          minTrackingConfidence: 0.3       // 検出感度を高める
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
            runningMode: 'IMAGE', // 【重要】VIDEO モードではなく IMAGE モードを使用
            numHands: 2,
            minHandDetectionConfidence: 0.3,
            minHandPresenceConfidence: 0.3,
            minTrackingConfidence: 0.3
          });
          console.log('HandLandmarker loaded with CPU fallback');
        } catch (fallbackError) {
          console.error('HandLandmarker CPU fallback failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      // 初期化チェック
      if (!handLandmarker) {
        console.error('HandLandmarkerの初期化に失敗しました');
        return false;
      }
      
      console.log('Loading GestureRecognizer model...');
      
      // GestureRecognizerを初期化（オプション）
      try {
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3
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
 * 空のランドマーク結果を生成する関数を追加
 */
function createEmptyHandLandmarkerResult(): HandLandmarkerResult {
  return {
    landmarks: [],
    worldLandmarks: [],
    handednesses: [],
    handedness: [] // 一部のバージョンで必要な場合
  };
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
    
    // ビデオ/画像サイズが有効かチェック
    if (source instanceof HTMLVideoElement) {
      // ビデオサイズが無効な場合は検出をスキップ
      if (source.videoWidth <= 0 || source.videoHeight <= 0) {
        console.warn('無効なビデオサイズ:', source.videoWidth, source.videoHeight);
        return createEmptyHandLandmarkerResult();
      }
    }

    // タイムスタンプを管理して一貫性を確保
    // もしタイムスタンプが前回よりも小さい場合は前回の値+1を使用
    const currentTimestamp = timestamp || Date.now();
    const safeTimestamp = currentTimestamp <= lastTimestamp 
      ? lastTimestamp + 1 
      : currentTimestamp;
    
    lastTimestamp = safeTimestamp;

    // 手のランドマークを検出
    try {
      // IMAGEモードで検出を行う (タイムスタンプを使用しない)
      const result = handLandmarker!.detect(source);
      return result;
    } catch (detectionError) {
      // 検出エラーの場合は、空の結果を返す
      console.warn('検出エラー（無視して続行）:', detectionError);
      return createEmptyHandLandmarkerResult();
    }
  } catch (error) {
    console.error('ハンドランドマーク検出エラー:', error);
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
    
    // イメージモードを使用
    return gestureRecognizer!.recognize(source);
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
  // ここで重要なのは、closeGraphのエラーを抑制するために
  // まずTensorFlowのコンソールエラーを一時的に無効化すること
  
  // オリジナルのコンソールエラーを保存
  const originalError = console.error;
  
  // TensorFlowのINFOメッセージを無視するよう設定
  console.error = function(...args) {
    // "INFO: Created TensorFlow" を含むメッセージを無視
    if (args[0] && typeof args[0] === 'string' && 
       (args[0].includes('TensorFlow') || args[0].includes('INFO:'))) {
      return;
    }
    // それ以外のエラーは通常どおり表示
    return originalError.apply(console, args);
  };

  try {
    // 先にgestureRecognizerを解放
    if (gestureRecognizer) {
      try {
        // クローズ前に少し遅延を入れることで安全に解放
        setTimeout(() => {
          try {
            gestureRecognizer!.close();
          } catch (err) {
            // エラーは抑制済み
          } finally {
            gestureRecognizer = null;
          }
        }, 0);
      } catch (err) {
        // エラーは無視
      }
    }
    
    // 次にhandLandmarkerを解放
    if (handLandmarker) {
      try {
        handLandmarker.close();
      } catch (err) {
        // エラーは抑制済み
      } finally {
        handLandmarker = null;
      }
    }
  } catch (error) {
    // すべてのエラーを無視
  } finally {
    // コンソールエラーを元に戻す
    console.error = originalError;
    
    isInitializing = false;
    initPromise = null;
  }
}