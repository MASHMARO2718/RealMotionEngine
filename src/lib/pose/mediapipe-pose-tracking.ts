/**
 * MediaPipe Pose Landmarkerを使用した全身ポーズ推定
 * WASM版を使用してブラウザで動作します。
 */

import { PoseLandmarker, PoseLandmarkerResult, FilesetResolver } from '@mediapipe/tasks-vision';

// ポーズランドマーカーのインスタンス
let poseLandmarker: PoseLandmarker | null = null;

// ポーズの種類
export type PoseType = 'standing' | 'sitting' | 'lying' | 'walking' | 'unknown' | 'none';

/**
 * MediaPipe Pose Landmarkerの初期化
 */
export async function initializeMediaPipePoseTracking(): Promise<boolean> {
  if (poseLandmarker) {
    console.log('ポーズランドマーカーはすでに初期化されています');
    return true;
  }

  try {
    console.log('ポーズランドマーカーの初期化を開始...');
    
    // WASMファイルセットの読み込み
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );
    
    // ポーズランドマーカーの作成
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numPoses: 1, // 検出するポーズの最大数
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false // セグメンテーションマスクは不要
    });
    
    console.log('ポーズランドマーカーの初期化完了');
    return true;
  } catch (error) {
    console.error('ポーズランドマーカーの初期化エラー:', error);
    return false;
  }
}

/**
 * ビデオフレームからポーズランドマークを検出
 */
export async function detectPoseLandmarks(
  video: HTMLVideoElement | null,
  timestamp: number
): Promise<PoseLandmarkerResult | null> {
  if (!poseLandmarker || !video) {
    return null;
  }
  
  try {
    // ビデオフレームからポーズを検出
    return poseLandmarker.detectForVideo(video, timestamp);
  } catch (error) {
    console.error('ポーズ検出エラー:', error);
    return null;
  }
}

/**
 * ポーズランドマーカーのリソース解放
 */
export function disposeMediaPipePoseTracking(): void {
  if (poseLandmarker) {
    try {
      // クローズメソッドがある場合は呼び出す
      (poseLandmarker as any).close?.();
      poseLandmarker = null;
      console.log('ポーズランドマーカーのリソースを解放しました');
    } catch (error) {
      console.error('ポーズランドマーカーのリソース解放中にエラーが発生しました:', error);
    }
  }
}

/**
 * ポーズの種類を分析する
 * ランドマークの位置関係から姿勢を推定します
 */
export function analyzePoseType(result: PoseLandmarkerResult): PoseType {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return 'none';
  }
  
  const landmarks = result.landmarks[0]; // 最初の検出された人物
  
  // 姿勢を判定するためのキーポイント
  const nose = landmarks[0]; // 鼻
  const leftShoulder = landmarks[11]; // 左肩
  const rightShoulder = landmarks[12]; // 右肩
  const leftHip = landmarks[23]; // 左ヒップ
  const rightHip = landmarks[24]; // 右ヒップ
  const leftKnee = landmarks[25]; // 左膝
  const rightKnee = landmarks[26]; // 右膝
  const leftAnkle = landmarks[27]; // 左足首
  const rightAnkle = landmarks[28]; // 右足首
  
  // 立っている状態の判定: 肩と足首のY座標の差が大きい
  const verticalDistance = Math.min(
    Math.abs(leftShoulder.y - leftAnkle.y),
    Math.abs(rightShoulder.y - rightAnkle.y)
  );
  
  // 座っている状態の判定: 膝が曲がっている
  const kneeAngle = calculateAngle(
    { x: leftHip.x, y: leftHip.y },
    { x: leftKnee.x, y: leftKnee.y },
    { x: leftAnkle.x, y: leftAnkle.y }
  );
  
  // 横になっている状態の判定: 肩と腰のY座標が近い
  const isLying = Math.abs(leftShoulder.y - leftHip.y) < 0.15;
  
  // 歩いている状態の判定: 足の動きから判定
  const legDistance = Math.abs(leftAnkle.x - rightAnkle.x);
  
  // 条件に基づいてポーズタイプを判定
  if (isLying) {
    return 'lying';
  } else if (kneeAngle < 140 && verticalDistance < 0.5) {
    return 'sitting';
  } else if (verticalDistance > 0.5 && legDistance > 0.2) {
    return 'walking';
  } else if (verticalDistance > 0.4) {
    return 'standing';
  }
  
  return 'unknown';
}

/**
 * 3点間の角度を計算 (度数法)
 */
function calculateAngle(
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  p3: { x: number, y: number }
): number {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  
  if (angle > 180) {
    angle = 360 - angle;
  }
  
  return angle;
}

/**
 * ポーズ検出の信頼度スコアを取得
 */
export function getPoseConfidence(result: PoseLandmarkerResult): number {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return 0;
  }
  
  // 各ランドマークの可視性スコアの平均を計算
  const landmarks = result.landmarks[0];
  let totalVisibility = 0;
  let count = 0;
  
  for (const landmark of landmarks) {
    if (landmark.visibility !== undefined) {
      totalVisibility += landmark.visibility;
      count++;
    }
  }
  
  return count > 0 ? totalVisibility / count : 0;
} 