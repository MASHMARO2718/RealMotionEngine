import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export interface HandLandmarkConfig {
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  runningMode?: 'IMAGE' | 'VIDEO';
  useGPU?: boolean;
}

let handLandmarker: HandLandmarker | null = null;
let initialized = false;
let initializing = false;

// 警告が既に表示されたかを追跡するフラグ
let warnedAboutInitialization = false;

/**
 * MediaPipe HandLandmarkerの初期化
 */
export async function initializeHandTracking(config: HandLandmarkConfig = {}): Promise<boolean> {
  if (initialized) return true;
  if (initializing) return false;
  
  try {
    initializing = true;
    
    console.log('Initializing MediaPipe HandLandmarker...');
    // より安定したCDNに変更
    const vision = await FilesetResolver.forVisionTasks(
      'https://unpkg.com/@mediapipe/tasks-vision@0.10.3/wasm'
    );
    
    console.log('Vision tasks loaded, creating HandLandmarker...');
    
    // GPU利用が指定されているか、未指定（デフォルトでCPU）の場合の設定
    const delegate = config.useGPU ? 'GPU' : 'CPU';
    console.log(`Using ${delegate} for MediaPipe processing`);
    
    // 実行モードを設定（デフォルトはVIDEO）
    const runningMode = config.runningMode || 'IMAGE';
    console.log(`Using ${runningMode} mode for MediaPipe HandLandmarker`);
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate
      },
      minHandDetectionConfidence: config.minHandDetectionConfidence || 0.5,
      minHandPresenceConfidence: config.minHandPresenceConfidence || 0.5,
      minTrackingConfidence: config.minTrackingConfidence || 0.5,
      runningMode,
      numHands: 2
    });
    
    initializing = false;
    initialized = true;
    console.log('MediaPipe HandLandmarker initialized successfully.');
    return true;
  } catch (error) {
    console.error('Error initializing MediaPipe HandLandmarker:', error);
    // より詳細なエラーログ
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    initializing = false;
    return false;
  }
}

/**
 * 画像からハンドランドマークを検出
 */
export function detectHandLandmarks(imageData: ImageData | HTMLVideoElement): HandLandmarkerResult | null {
  if (!handLandmarker || !initialized) {
    // 未初期化警告は1回だけ表示
    if (!warnedAboutInitialization) {
      console.warn('HandLandmarker not initialized. Call initializeHandTracking() first.');
      warnedAboutInitialization = true;
    }
    return null;
  }
  
  // 初期化済みなら警告フラグをリセット
  warnedAboutInitialization = false;
  
  try {
    // IMAGEモードでの検出
    return handLandmarker.detect(imageData);
  } catch (error) {
    console.error('Error detecting hand landmarks:', error);
    
    // runningModeエラーの場合、再初期化を試みる
    if (error instanceof Error && error.message.includes('runningMode')) {
      console.log('Attempting to reinitialize with correct runningMode...');
      initialized = false;
      initializing = false;
      
      // 非同期で再初期化（結果は次回のdetectで使用）
      initializeHandTracking({ runningMode: 'IMAGE' }).then(success => {
        console.log(`Reinitialization ${success ? 'succeeded' : 'failed'}`);
      });
    }
    
    return null;
  }
}

/**
 * 指先の座標を抽出（親指、人差し指、中指、薬指、小指）
 */
export function getFingerTips(result: HandLandmarkerResult | null): { [key: string]: { x: number, y: number, z: number } } | null {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return null;
  }
  
  // 最初の検出された手のランドマークを使用
  const landmarks = result.landmarks[0];
  
  // 指先のインデックス（MediaPipeの定義に基づく）
  const fingerTipIndices = {
    thumb: 4,    // 親指
    index: 8,    // 人差し指
    middle: 12,  // 中指
    ring: 16,    // 薬指
    pinky: 20    // 小指
  };
  
  const fingerTips: { [key: string]: { x: number, y: number, z: number } } = {};
  
  for (const [finger, index] of Object.entries(fingerTipIndices)) {
    const landmark = landmarks[index];
    fingerTips[finger] = {
      x: landmark.x,
      y: landmark.y,
      z: landmark.z
    };
  }
  
  return fingerTips;
}

/**
 * 手のジェスチャーを判定
 */
export function recognizeHandGesture(result: HandLandmarkerResult | null): string | null {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return null;
  }
  
  const landmarks = result.landmarks[0];
  
  // 指が開いているかどうかを判定（親指は別の計算が必要）
  const fingerIsOpen = {
    index: isFingerOpen(landmarks, 5, 6, 7, 8),
    middle: isFingerOpen(landmarks, 9, 10, 11, 12),
    ring: isFingerOpen(landmarks, 13, 14, 15, 16),
    pinky: isFingerOpen(landmarks, 17, 18, 19, 20)
  };
  
  // 親指が開いているかどうかを判定（親指は少し複雑）
  const thumbIsOpen = isThumbOpen(landmarks);
  
  // ジェスチャーの判定ロジック
  if (thumbIsOpen && !fingerIsOpen.index && !fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    return 'thumbs_up';
  } else if (!thumbIsOpen && fingerIsOpen.index && !fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    return 'pointing';
  } else if (thumbIsOpen && fingerIsOpen.index && !fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    return 'gun';
  } else if (thumbIsOpen && fingerIsOpen.index && fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    return 'three';
  } else if (thumbIsOpen && fingerIsOpen.index && fingerIsOpen.middle && fingerIsOpen.ring && fingerIsOpen.pinky) {
    return 'open_hand';
  } else if (!thumbIsOpen && !fingerIsOpen.index && !fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    return 'fist';
  } else if (!thumbIsOpen && fingerIsOpen.index && fingerIsOpen.pinky && !fingerIsOpen.middle && !fingerIsOpen.ring) {
    return 'rock';
  } else if (!thumbIsOpen && fingerIsOpen.index && fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    return 'peace';
  }
  
  return 'unknown';
}

/**
 * 指が開いているかどうかを判定するヘルパー関数
 */
function isFingerOpen(landmarks: any[], mcp: number, pip: number, dip: number, tip: number): boolean {
  // MCPは指の根元、TIPは指先
  const mcpPoint = landmarks[mcp];
  const tipPoint = landmarks[tip];
  const pipPoint = landmarks[pip];
  
  // 指先がMCPよりも十分に遠い場合、指は開いていると判断
  const distanceFromMcpToTip = distance3D(mcpPoint, tipPoint);
  const distanceFromMcpToPip = distance3D(mcpPoint, pipPoint);
  
  return distanceFromMcpToTip > distanceFromMcpToPip * 1.2;
}

/**
 * 親指が開いているかどうかを判定するヘルパー関数
 */
function isThumbOpen(landmarks: any[]): boolean {
  const wrist = landmarks[0];
  const thumbCmc = landmarks[1];
  const thumbMcp = landmarks[2];
  const thumbIp = landmarks[3];
  const thumbTip = landmarks[4];
  
  // 親指の付け根から先端までの距離
  const distanceFromCmcToTip = distance3D(thumbCmc, thumbTip);
  const distanceFromWristToMcp = distance3D(wrist, thumbMcp);
  
  return distanceFromCmcToTip > distanceFromWristToMcp * 0.8;
}

/**
 * 3D空間での2点間の距離を計算するヘルパー関数
 */
function distance3D(p1: { x: number, y: number, z: number }, p2: { x: number, y: number, z: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
} 