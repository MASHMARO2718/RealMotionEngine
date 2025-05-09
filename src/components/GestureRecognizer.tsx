'use client';

import { useEffect, useState, useRef } from 'react';
import MotionTracker from './MotionTracker';
import { Point, matchGesture, smoothness } from '../lib/motion-utils';

// 事前定義されたジェスチャーテンプレート
const gestureTemplates = {
  circle: [
    { x: 0.5, y: 0.0 }, { x: 0.85, y: 0.15 }, { x: 1.0, y: 0.5 },
    { x: 0.85, y: 0.85 }, { x: 0.5, y: 1.0 }, { x: 0.15, y: 0.85 },
    { x: 0.0, y: 0.5 }, { x: 0.15, y: 0.15 }, { x: 0.5, y: 0.0 }
  ],
  swipeRight: [
    { x: 0.0, y: 0.5 }, { x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 },
    { x: 0.6, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 1.0, y: 0.5 }
  ],
  swipeLeft: [
    { x: 1.0, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.6, y: 0.5 },
    { x: 0.4, y: 0.5 }, { x: 0.2, y: 0.5 }, { x: 0.0, y: 0.5 }
  ],
  swipeUp: [
    { x: 0.5, y: 1.0 }, { x: 0.5, y: 0.8 }, { x: 0.5, y: 0.6 },
    { x: 0.5, y: 0.4 }, { x: 0.5, y: 0.2 }, { x: 0.5, y: 0.0 }
  ],
  swipeDown: [
    { x: 0.5, y: 0.0 }, { x: 0.5, y: 0.2 }, { x: 0.5, y: 0.4 },
    { x: 0.5, y: 0.6 }, { x: 0.5, y: 0.8 }, { x: 0.5, y: 1.0 }
  ],
  zigzag: [
    { x: 0.0, y: 0.5 }, { x: 0.2, y: 0.2 }, { x: 0.4, y: 0.8 },
    { x: 0.6, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 1.0, y: 0.5 }
  ]
};

export type GestureType = keyof typeof gestureTemplates;

interface GestureRecognizerProps {
  width?: number;
  height?: number;
  onGestureDetected?: (gesture: GestureType) => void;
}

export default function GestureRecognizer({
  width = 640,
  height = 480,
  onGestureDetected
}: GestureRecognizerProps) {
  const [positions, setPositions] = useState<Point[]>([]);
  const [currentGesture, setCurrentGesture] = useState<GestureType | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [trajectorySmoothing, setTrajectorySmoothing] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 新しい位置の更新を処理
  const handlePositionUpdate = (position: Point) => {
    // 既に録画中の場合、点を追加
    if (isRecording) {
      setPositions(prev => [...prev, position]);
      
      // ジェスチャーが長すぎる場合は古い点を削除（50点まで）
      if (positions.length > 50) {
        setPositions(prev => prev.slice(-50));
      }
      
      // 軌道の滑らかさを計算
      if (positions.length >= 3) {
        const smoothVal = smoothness(positions);
        setTrajectorySmoothing(smoothVal);
      }
    } else {
      // 録画中でなければ録画開始
      setIsRecording(true);
      setPositions([position]);
      setCurrentGesture(null);
      
      // タイムアウトを設定（記録停止のため）
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
    
    // 動きが止まったときに録画を停止するタイマーをリセット
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      // 十分な点がある場合、ジェスチャーを認識
      if (positions.length >= 10) {
        recognizeGesture();
      }
      setIsRecording(false);
    }, 500); // 0.5秒動きがなければ停止
  };
  
  // 記録された軌道からジェスチャーを認識
  const recognizeGesture = () => {
    if (positions.length < 10) return;
    
    // 各ジェスチャーテンプレートとのマッチング度を計算
    const scores: Record<GestureType, number> = {} as Record<GestureType, number>;
    let bestMatch: GestureType | null = null;
    let bestScore = 0;
    
    for (const [gesture, template] of Object.entries(gestureTemplates) as [GestureType, Point[]][]) {
      const similarity = matchGesture(positions, template, 0) ? 1 : 0; // 類似度しきい値を0に設定して値を取得
      scores[gesture] = similarity;
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = gesture;
      }
    }
    
    // 類似度が一定以上なら検出したジェスチャーを設定
    if (bestScore >= 0.65) {
      setCurrentGesture(bestMatch);
      onGestureDetected?.(bestMatch as GestureType);
    } else {
      setCurrentGesture(null);
    }
  };
  
  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div className="relative">
      <MotionTracker 
        width={width} 
        height={height}
        threshold={30}
        onPositionUpdate={handlePositionUpdate}
      />
      
      {/* ジェスチャー情報のオーバーレイ */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded">
        <div className="text-sm mb-2">
          {isRecording ? (
            <span className="flex items-center">
              <span className="h-2 w-2 bg-red-500 rounded-full mr-2"></span>
              録画中...
            </span>
          ) : positions.length > 0 ? (
            <span>ジェスチャー分析完了</span>
          ) : (
            <span>動きを検出していません</span>
          )}
        </div>
        
        {currentGesture && (
          <div className="font-bold text-lg mb-1">
            検出: <span className="text-green-400">{currentGesture}</span>
          </div>
        )}
        
        <div className="text-xs opacity-80">
          軌道の滑らかさ: {trajectorySmoothing.toFixed(2)}
        </div>
        
        <div className="text-xs opacity-80">
          ポイント数: {positions.length}
        </div>
      </div>
    </div>
  );
} 