/**
 * MediaPipeハンドトラッキング用のユーティリティ関数
 * 主にランドマークの描画や座標変換などを提供します
 */

import { HandLandmarkerResult } from '@mediapipe/tasks-vision';

// サイバーパンク風カラーテーマ
export const CYBERPUNK_COLORS = {
  // 基本カラー
  primary: 'rgba(0, 255, 136, 1)',      // より鮮明なネオングリーン
  secondary: 'rgba(255, 41, 117, 1)',   // より鮮明なネオンピンク
  accent: 'rgba(0, 234, 255, 1)',       // より鮮明なシアン
  
  // 特殊効果用
  glow: 'rgba(0, 255, 136, 0.6)',         // より強いグローエフェクト
  highlight: 'rgba(255, 247, 0, 1)',    // より鮮明なハイライト
  
  // 手のランドマーク用
  thumb: 'rgba(255, 41, 117, 1)',       // より鮮明なネオンピンク
  indexFinger: 'rgba(0, 255, 255, 1)',  // より鮮明なシアン
  middleFinger: 'rgba(149, 0, 255, 1)', // より鮮明なネオンパープル
  ringFinger: 'rgba(0, 234, 255, 1)',   // より鮮明なエレクトリックブルー
  pinky: 'rgba(255, 102, 255, 1)',      // より鮮明なネオンマゼンタ
  palmBase: 'rgba(0, 255, 136, 1)',     // より鮮明なネオングリーン
  
  // コネクションライン用
  connection: 'rgba(0, 255, 136, 1)',   // より鮮明なネオングリーン
  
  // UI要素用
  background: 'rgba(5, 0, 20, 0.7)',      // 暗めのバックグラウンド
  text: 'rgba(0, 255, 136, 1)',           // テキスト
  grid: 'rgba(0, 255, 136, 0.2)',         // グリッド
};

// 指先用のグロー効果カラー
export const TIP_GLOW_COLORS = {
  thumb: 'rgba(255, 41, 117, 0.6)',       // 透明度を高めたネオンピンク
  indexFinger: 'rgba(0, 255, 255, 0.6)',  // 透明度を高めたシアン 
  middleFinger: 'rgba(149, 0, 255, 0.6)', // 透明度を高めたネオンパープル
  ringFinger: 'rgba(0, 234, 255, 0.6)',   // 透明度を高めたエレクトリックブルー
  pinky: 'rgba(255, 102, 255, 0.6)',      // 透明度を高めたネオンマゼンタ
};

// 手の各部分の接続関係（インデックス番号）
export const HAND_CONNECTIONS = [
  // 親指
  [0, 1], [1, 2], [2, 3], [3, 4],
  // 人差し指
  [0, 5], [5, 6], [6, 7], [7, 8],
  // 中指
  [0, 9], [9, 10], [10, 11], [11, 12],
  // 薬指
  [0, 13], [13, 14], [14, 15], [15, 16],
  // 小指
  [0, 17], [17, 18], [18, 19], [19, 20],
  // 手のひらの接続
  [0, 5], [5, 9], [9, 13], [13, 17]
];

// 指先のインデックス番号
export const FINGERTIPS = [4, 8, 12, 16, 20];

/**
 * キャンバスに手のランドマークを描画する関数
 */
export function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  result: HandLandmarkerResult,
  videoWidth: number,
  videoHeight: number,
  isMirrored: boolean = true,
  glowSize: number = 15
): void {
  // 結果がない場合は早期リターン
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return;
  }
  
  // 検出された各手に対して処理
  for (const landmarks of result.landmarks) {
    // 接続線を描画
    ctx.lineWidth = 3; // より太い線に変更
    
    // 手の接続線を描画（グラデーション効果を追加）
    for (const connection of HAND_CONNECTIONS) {
      const [start, end] = connection;
      
      // 接続位置の取得と変換
      const startPoint = transformLandmark(landmarks[start], videoWidth, videoHeight, isMirrored);
      const endPoint = transformLandmark(landmarks[end], videoWidth, videoHeight, isMirrored);
      
      // グラデーション効果を追加
      const gradient = ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
      gradient.addColorStop(0, CYBERPUNK_COLORS.connection);
      gradient.addColorStop(1, 'rgba(0, 255, 200, 1)');
      
      // 接続線の描画
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      
      // グラデーションの接続線
      ctx.strokeStyle = gradient;
      
      // 線に発光効果を追加
      ctx.shadowColor = CYBERPUNK_COLORS.glow;
      ctx.shadowBlur = 5;
      
      ctx.stroke();
      
      // 影の効果をリセット
      ctx.shadowBlur = 0;
    }
    
    // ランドマークを描画
    landmarks.forEach((landmark, index) => {
      const point = transformLandmark(landmark, videoWidth, videoHeight, isMirrored);
      
      // 指先のみグロー効果を追加
      if (FINGERTIPS.includes(index)) {
        // 指先ごとに異なる色を使用
        let glowColor = TIP_GLOW_COLORS.thumb; // デフォルト値を設定
        if (index === 4) glowColor = TIP_GLOW_COLORS.thumb;
        else if (index === 8) glowColor = TIP_GLOW_COLORS.indexFinger;
        else if (index === 12) glowColor = TIP_GLOW_COLORS.middleFinger;
        else if (index === 16) glowColor = TIP_GLOW_COLORS.ringFinger;
        else if (index === 20) glowColor = TIP_GLOW_COLORS.pinky;
        
        // グローエフェクト（よりコンパクトなサイズに変更）
        ctx.beginPath();
        ctx.arc(point.x, point.y, glowSize * 0.6, 0, 2 * Math.PI); // サイズを小さく
        ctx.fillStyle = glowColor;
        ctx.fill();
      }
      
      // ランドマーク自体（鮮明な点）を描画
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI); // サイズを少し大きく
      
      // 指の種類によって色を変える
      if (index >= 1 && index <= 4) {
        ctx.fillStyle = CYBERPUNK_COLORS.thumb;
      } else if (index >= 5 && index <= 8) {
        ctx.fillStyle = CYBERPUNK_COLORS.indexFinger;
      } else if (index >= 9 && index <= 12) {
        ctx.fillStyle = CYBERPUNK_COLORS.middleFinger;
      } else if (index >= 13 && index <= 16) {
        ctx.fillStyle = CYBERPUNK_COLORS.ringFinger;
      } else if (index >= 17 && index <= 20) {
        ctx.fillStyle = CYBERPUNK_COLORS.pinky;
      } else {
        ctx.fillStyle = CYBERPUNK_COLORS.palmBase;
      }
      
      // 発光効果を追加
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 5;
      
      ctx.fill();
      
      // 影の効果をリセット
      ctx.shadowBlur = 0;
    });
  }
}

/**
 * ランドマーク座標をキャンバス座標に変換
 */
export function transformLandmark(
  landmark: { x: number, y: number, z: number },
  videoWidth: number,
  videoHeight: number,
  isMirrored: boolean = true
): { x: number, y: number } {
  // ミラーモードの場合はX座標を反転
  const x = isMirrored
    ? videoWidth - landmark.x * videoWidth
    : landmark.x * videoWidth;
  
  const y = landmark.y * videoHeight;
  
  return { x, y };
}

/**
 * サイバーパンク風グリッドパターンを描画
 */
export function drawCyberpunkGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number = 40
): void {
  ctx.save();
  
  // グリッドの描画
  ctx.strokeStyle = CYBERPUNK_COLORS.grid;
  ctx.lineWidth = 1;
  
  // 横線
  for (let y = 0; y <= height; y += cellSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // 縦線
  for (let x = 0; x <= width; x += cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * サイバーパンク風スキャニングメッセージを表示
 */
export function drawScanningMessage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  
  // 背景にグラデーションの透明なボックスを描画
  const gradient = ctx.createLinearGradient(0, height / 2 - 40, 0, height / 2 + 40);
  gradient.addColorStop(0, 'rgba(0, 0, 20, 0)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 20, 0.6)');
  gradient.addColorStop(1, 'rgba(0, 0, 20, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height / 2 - 40, width, 80);
  
  // テキスト描画
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // テキストに輝きを追加
  ctx.shadowColor = CYBERPUNK_COLORS.primary;
  ctx.shadowBlur = 10;
  ctx.fillStyle = CYBERPUNK_COLORS.text;
  
  // テキストの表示
  const currentTime = Date.now();
  const blinkRate = (currentTime % 1000) < 500;
  const message = blinkRate ? 'SCANNING FOR HAND INPUT' : 'SCANNING FOR HAND INPUT_';
  
  ctx.fillText(message, width / 2, height / 2);
  
  ctx.restore();
} 