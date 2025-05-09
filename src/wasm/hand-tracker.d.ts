// WebAssemblyモジュールの型定義

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// 手のジェスチャータイプ
export enum GestureType {
  UNKNOWN = -1,
  FIST = 0,
  ONE_FINGER = 1,
  TWO_FINGERS = 2,
  THREE_FINGERS = 3,
  FOUR_FINGERS = 4,
  FIVE_FINGERS = 5,
  OK_GESTURE = 6,
  THUMB_UP = 7
}

export interface HandLandmark {
  points: Point3D[];
  gesture?: GestureType;
}

export interface HandTrackingResult {
  hands: HandLandmark[];
  score: number;
}

export interface HandTrackerModule {
  // 初期化関数
  initialize_hand_tracker(): number;
  
  // 画像データから手のランドマークを検出する関数
  detect_hand_landmarks(imageData: Uint8Array | Uint8ClampedArray, width: number, height: number): number;
  
  // 指の先端座標を取得する関数
  get_finger_tips(resultPtr: number): number;
  
  // 手のジェスチャーを認識する関数
  recognize_gesture(resultPtr: number, handIndex: number): number;
  
  // メモリ解放関数
  free_tracking_result(resultPtr: number): void;
  free_points(pointsPtr: number): void;
  
  // ヘルパー関数
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
}

// Point3D配列をC++ポインターからJavaScriptオブジェクトに変換するヘルパー関数
export function parsePoint3DArray(module: HandTrackerModule, ptr: number, count: number): Point3D[] {
  if (ptr === 0) return [];
  
  const points: Point3D[] = [];
  const floatSize = 4; // float型のサイズ（バイト）
  const pointSize = 3 * floatSize; // x, y, z各4バイト
  
  for (let i = 0; i < count; i++) {
    const offset = ptr + i * pointSize;
    const x = module.HEAPF32[(offset >> 2)];
    const y = module.HEAPF32[(offset >> 2) + 1];
    const z = module.HEAPF32[(offset >> 2) + 2];
    points.push({ x, y, z });
  }
  
  return points;
}

// HandTrackingResultをC++ポインターからJavaScriptオブジェクトに変換するヘルパー関数
export function parseHandTrackingResult(module: HandTrackerModule, ptr: number): HandTrackingResult | null {
  if (ptr === 0) return null;
  
  // TODO: 実際のメモリレイアウトに合わせて実装
  // この部分は実際のC++の構造体レイアウトに合わせる必要があります
  
  return {
    hands: [],
    score: 0
  };
}

// C++で定義した関数をJavaScriptから呼び出すためのラッパー
export default interface HandTrackerInstance {
  // 初期化
  initialize(): Promise<boolean>;
  
  // 画像データから手のランドマークを検出
  detectHandLandmarks(imageData: ImageData | Uint8ClampedArray, width?: number, height?: number): Promise<HandTrackingResult | null>;
  
  // 指先の座標を取得
  getFingerTips(result: HandTrackingResult): Promise<Point3D[]>;
  
  // 手のジェスチャーを認識
  recognizeGesture(result: HandTrackingResult, handIndex: number): Promise<GestureType>;
  
  // リソース解放
  dispose(): void;
  
  // モジュールが読み込まれたかどうか
  isLoaded: boolean;
} 