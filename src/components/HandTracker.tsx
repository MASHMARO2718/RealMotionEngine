'use client';

import { useEffect, useRef, useState } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import CameraInput from './CameraInput';
import { 
  initializeHandTracking, 
  detectHandLandmarks, 
  getFingerTips,
  recognizeHandGesture
} from '../lib/mediapipe-utils';

interface HandTrackerProps {
  width?: number;
  height?: number;
  onGestureDetected?: (gesture: string) => void;
  onHandLandmarksDetected?: (landmarks: HandLandmarkerResult) => void;
}

export default function HandTracker({
  width = 640,
  height = 480,
  onGestureDetected,
  onHandLandmarksDetected
}: HandTrackerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handLandmarks, setHandLandmarks] = useState<HandLandmarkerResult | null>(null);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializeAttemptedRef = useRef(false);
  const warningShownRef = useRef(false);
  
  // MediaPipeの初期化
  useEffect(() => {
    async function init() {
      try {
        if (initializeAttemptedRef.current) return;
        initializeAttemptedRef.current = true;
        
        setIsLoading(true);
        console.log('Starting MediaPipe initialization...');
        
        // 初期化を3回まで試行
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!success && attempts < maxAttempts) {
          attempts++;
          console.log(`Attempt ${attempts} to initialize MediaPipe...`);
          
          success = await initializeHandTracking({
            runningMode: 'VIDEO',
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            useGPU: false // GPUを使用せずCPUモードで実行（安定性向上）
          });
          
          if (!success && attempts < maxAttempts) {
            console.log(`Retrying in 1 second... (attempt ${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
          }
        }
        
        if (success) {
          setIsInitialized(true);
          setError(null);
          console.log('MediaPipe initialized successfully after', attempts, 'attempts');
        } else {
          console.error('Failed to initialize MediaPipe after', maxAttempts, 'attempts');
          setError(`MediaPipe初期化失敗 (${maxAttempts}回試行)`);
        }
      } catch (err) {
        console.error('初期化エラー:', err);
        setError('MediaPipe初期化中にエラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    }
    
    init();
    
    // コンポーネントのアンマウント時にクリーンアップ
    return () => {
      initializeAttemptedRef.current = false;
      warningShownRef.current = false;
    };
  }, []);
  
  // ビデオフレームの処理
  const handleFrame = (imageData: ImageData) => {
    if (!isInitialized) {
      // MediaPipeが初期化されていない場合
      if (!warningShownRef.current) {
        // 初回のみコンソールに警告を表示
        console.warn('MediaPipe is not initialized, using fallback mode');
        warningShownRef.current = true;
      }
      
      // フォールバックのモーション検出に切り替え
      fallbackMotionDetection(imageData);
      return;
    }
    
    // 警告フラグをリセット（初期化に成功した場合）
    warningShownRef.current = false;
    
    // ハンドランドマークの検出
    const result = detectHandLandmarks(imageData);
    setHandLandmarks(result);
    
    if (result && result.landmarks && result.landmarks.length > 0) {
      // ジェスチャーの認識
      const gesture = recognizeHandGesture(result);
      if (gesture) {
        setCurrentGesture(gesture);
        onGestureDetected?.(gesture);
      }
      
      // 外部ハンドラーへの通知
      onHandLandmarksDetected?.(result);
      
      // キャンバスへの描画
      drawHandLandmarks(result);
    } else {
      // 手が検出されない場合はキャンバスをクリア
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  };
  
  // フォールバック用の単純なモーション検出
  const fallbackMotionDetection = (imageData: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 画像データから輝度の高い点を検出（単純な実装）
    const data = imageData.data;
    let maxBrightness = 0;
    let maxX = 0;
    let maxY = 0;
    
    // 10ピクセルごとにサンプリング（パフォーマンス向上）
    for (let y = 0; y < imageData.height; y += 10) {
      for (let x = 0; x < imageData.width; x += 10) {
        const i = (y * imageData.width + x) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness > maxBrightness && brightness > 100) { // 閾値
          maxBrightness = brightness;
          maxX = x;
          maxY = y;
        }
      }
    }
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 最も明るい点を表示
    if (maxBrightness > 100) {
      ctx.beginPath();
      ctx.arc(maxX, maxY, 15, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // フォールバックモードの表示
      ctx.font = '16px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('フォールバックモード: MediaPipe利用不可', 10, 30);
    }
  };
  
  // ハンドランドマークの描画
  const drawHandLandmarks = (result: HandLandmarkerResult) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 各検出された手について
    result.landmarks.forEach((landmarks, handIndex) => {
      // 手のランドマークを接続する線を描画
      drawConnectors(ctx, landmarks, handIndex);
      
      // 各ランドマークを描画
      landmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        // 指先のポイントは大きく表示
        const isFingerTip = [4, 8, 12, 16, 20].includes(index);
        const radius = isFingerTip ? 6 : 3;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isFingerTip ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.5)';
        ctx.fill();
      });
      
      // 指先座標の取得
      const fingerTips = getFingerTips(result);
      if (fingerTips) {
        // 指先の名前を表示
        Object.entries(fingerTips).forEach(([finger, position]) => {
          const x = position.x * canvas.width;
          const y = position.y * canvas.height;
          
          ctx.font = '12px Arial';
          ctx.fillStyle = 'white';
          ctx.fillText(finger, x + 10, y - 10);
        });
      }
    });
  };
  
  // ハンドランドマークを接続する線を描画するヘルパー関数
  const drawConnectors = (ctx: CanvasRenderingContext2D, landmarks: any[], handIndex: number) => {
    // 指のコネクション（インデックスのペア）
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],           // 親指
      [0, 5], [5, 6], [6, 7], [7, 8],           // 人差し指
      [5, 9], [9, 10], [10, 11], [11, 12],      // 中指
      [9, 13], [13, 14], [14, 15], [15, 16],    // 薬指
      [13, 17], [17, 18], [18, 19], [19, 20],   // 小指
      [0, 17], [5, 9], [9, 13], [13, 17]        // 手のひら
    ];
    
    // 線の色（左右の手で色を変える）
    const color = handIndex === 0 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    connections.forEach(([i, j]) => {
      const point1 = landmarks[i];
      const point2 = landmarks[j];
      
      const x1 = point1.x * ctx.canvas.width;
      const y1 = point1.y * ctx.canvas.height;
      const x2 = point2.x * ctx.canvas.width;
      const y2 = point2.y * ctx.canvas.height;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  };
  
  return (
    <div className="relative camera-container">
      <CameraInput width={width} height={height} onFrame={handleFrame} />
      
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-center">
            <div className="mb-2">MediaPipe HandLandmarkerを読み込み中...</div>
            <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute bottom-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <div className="font-bold mb-1">エラー</div>
          <div className="text-sm">{error}</div>
          <div className="text-xs mt-2">フォールバックモードで実行中...</div>
        </div>
      )}
      
      {currentGesture && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded">
          検出: <span className="font-bold text-green-400">{currentGesture}</span>
        </div>
      )}
    </div>
  );
} 