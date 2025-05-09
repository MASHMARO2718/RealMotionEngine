import { HandLandmarkerResult, NormalizedLandmark, Landmark } from '@mediapipe/tasks-vision';
import { getHandTracker } from '../wasm/hand-tracker-loader';
import { HandTrackingResult, Point3D, GestureType } from '../wasm/hand-tracker';
import HandTrackerInstance from '../wasm/hand-tracker';

// WASM版ハンドトラッカーモジュールのインスタンス
let wasmHandTrackerPromise: Promise<HandTrackerInstance> | null = null;

// ハンドトラッカーの初期化
export async function initializeWasmHandTracking(): Promise<boolean> {
  try {
    if (!wasmHandTrackerPromise) {
      console.log('【デバッグ】WASM版ハンドトラッカーを初期化中...');
      wasmHandTrackerPromise = getHandTracker();
    }
    
    const handTracker = await wasmHandTrackerPromise;
    if (!handTracker) {
      return false;
    }
    
    const success = await handTracker.initialize();
    
    console.log(`【デバッグ】WASM版ハンドトラッカー初期化: ${success ? '成功' : '失敗'}`);
    return success;
  } catch (error) {
    console.error('【デバッグ】WASM版ハンドトラッカー初期化エラー:', error);
    return false;
  }
}

// 画像データから手のランドマークを検出
export async function detectWasmHandLandmarks(
  imageData: ImageData | HTMLVideoElement
): Promise<HandLandmarkerResult | null> {
  try {
    if (!wasmHandTrackerPromise) {
      const initialized = await initializeWasmHandTracking();
      if (!initialized) return null;
    }
    
    const handTracker = await wasmHandTrackerPromise;
    if (!handTracker) {
      return null;
    }
    
    let result: HandTrackingResult | null = null;
    
    if (imageData instanceof HTMLVideoElement) {
      // ビデオ要素から画像データを取得
      const canvas = document.createElement('canvas');
      canvas.width = imageData.videoWidth;
      canvas.height = imageData.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('【デバッグ】キャンバスコンテキストの取得に失敗');
        return null;
      }
      
      ctx.drawImage(imageData, 0, 0);
      const canvasImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // WASM版ハンドトラッカーを使用して検出
      result = await handTracker.detectHandLandmarks(canvasImageData);
    } else {
      // ImageDataを直接使用
      result = await handTracker.detectHandLandmarks(imageData);
    }
    
    if (!result || !result.hands || result.hands.length === 0) {
      return null;
    }
    
    // WASM版の結果をMediaPipe形式に変換
    return convertToMediaPipeFormat(result);
  } catch (error) {
    console.error('【デバッグ】WASM版ハンドランドマーク検出エラー:', error);
    return null;
  }
}

// 指先の座標を取得
export async function getWasmFingerTips(
  result: HandTrackingResult
): Promise<Point3D[]> {
  try {
    if (!wasmHandTrackerPromise) {
      await initializeWasmHandTracking();
      return [];
    }
    
    const handTracker = await wasmHandTrackerPromise;
    if (!handTracker) {
      return [];
    }
    
    return await handTracker.getFingerTips(result);
  } catch (error) {
    console.error('【デバッグ】WASM版指先座標取得エラー:', error);
    return [];
  }
}

// 手のジェスチャーを認識する
export async function recognizeWasmHandGesture(
  result: HandTrackingResult | HandLandmarkerResult,
  handIndex: number = 0
): Promise<string> {
  try {
    // HandTrackingResultの場合
    if ('hands' in result && Array.isArray(result.hands)) {
      if (!wasmHandTrackerPromise) {
        await initializeWasmHandTracking();
        return 'unknown';
      }
      
      const handTracker = await wasmHandTrackerPromise;
      if (!handTracker || handIndex >= result.hands.length) {
        return 'unknown';
      }
      
      // ジェスチャーがすでに計算されている場合はそれを使用
      if (result.hands[handIndex].gesture !== undefined) {
        return gestureTypeToString(result.hands[handIndex].gesture);
      }
      
      // C++側のジェスチャー認識を使用
      const gestureType = await handTracker.recognizeGesture(result, handIndex);
      return gestureTypeToString(gestureType);
    } 
    // HandLandmarkerResultの場合 (MediaPipe形式)
    else if ('landmarks' in result && Array.isArray(result.landmarks)) {
      if (handIndex >= result.landmarks.length) {
        return 'unknown';
      }
      
      // MediaPipe形式からジェスチャーを認識
      return recognizeGestureFromMediaPipe(result);
    }
    
    return 'unknown';
  } catch (error) {
    console.error('【デバッグ】WASM版ジェスチャー認識エラー:', error);
    return 'unknown';
  }
}

// GestureType値を文字列に変換する
function gestureTypeToString(gestureType: GestureType): string {
  switch (gestureType) {
    case GestureType.FIST:
      return 'fist';
    case GestureType.ONE_FINGER:
      return 'pointing';
    case GestureType.TWO_FINGERS:
      return 'peace';
    case GestureType.THREE_FINGERS:
      return 'three';
    case GestureType.FOUR_FINGERS:
      return 'four';
    case GestureType.FIVE_FINGERS:
      return 'open_hand';
    case GestureType.OK_GESTURE:
      return 'ok';
    case GestureType.THUMB_UP:
      return 'thumbs_up';
    default:
      return 'unknown';
  }
}

// WASMハンドトラッキング結果をMediaPipe形式に変換
function convertToMediaPipeFormat(
  wasmResult: HandTrackingResult
): HandLandmarkerResult {
  // MediaPipe形式のオブジェクトを作成
  const result: HandLandmarkerResult = {
    landmarks: [],
    handedness: [],
    worldLandmarks: [],
    handednesses: [[]] // 必須のプロパティを追加
  };
  
  // 各手のランドマークを変換
  wasmResult.hands.forEach((hand, index) => {
    // NormalizedLandmark配列（可視性プロパティを追加）
    const landmarks: NormalizedLandmark[] = hand.points.map(point => ({
      x: point.x,
      y: point.y,
      z: point.z,
      visibility: 1.0 // 可視性（0.0〜1.0）
    }));
    
    // Landmark配列（可視性プロパティを追加）
    const worldLandmarks: Landmark[] = hand.points.map(point => ({
      x: point.x,
      y: point.y,
      z: point.z,
      visibility: 1.0 // 可視性（0.0〜1.0）
    }));
    
    // 手の左右情報
    const handedness = [{
      categoryName: index === 0 ? 'Right' : 'Left',
      displayName: index === 0 ? 'Right' : 'Left',
      score: wasmResult.score || 0.9,
      index: index
    }];
    
    result.landmarks.push(landmarks);
    result.worldLandmarks.push(worldLandmarks);
    result.handedness.push(handedness);
    result.handednesses[0].push(handedness[0]);
  });
  
  return result;
}

// MediaPipe形式のハンドランドマークからジェスチャーを認識 (フォールバック用)
function recognizeGestureFromMediaPipe(result: HandLandmarkerResult): string {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return 'unknown';
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
  } else if (thumbIsOpen && fingerIsOpen.index && !fingerIsOpen.middle && !fingerIsOpen.ring && !fingerIsOpen.pinky) {
    // 親指と人差し指が丸を作っているか確認
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = distance3D(thumbTip, indexTip);
    
    if (distance < 0.1) { // 距離が近い場合、OKサインと判断
      return 'ok';
    }
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