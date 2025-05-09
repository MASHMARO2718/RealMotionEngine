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
        console.log('【デバッグ】Starting MediaPipe initialization...');
        
        // 初期化を3回まで試行
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!success && attempts < maxAttempts) {
          attempts++;
          console.log(`【デバッグ】Attempt ${attempts} to initialize MediaPipe...`);
          
          success = await initializeHandTracking({
            runningMode: 'IMAGE', // VIDEOからIMAGEに変更（より安定）
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            useGPU: false // GPUを使用せずCPUモードで実行（安定性向上）
          });
          
          if (!success && attempts < maxAttempts) {
            console.log(`【デバッグ】Retrying in 1 second... (attempt ${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
          }
        }
        
        if (success) {
          setIsInitialized(true);
          setError(null);
          console.log('【デバッグ】MediaPipe initialized successfully after', attempts, 'attempts');
          
          // キャンバスが正しく描画できるか確認するためのテスト
          setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                console.log('【デバッグ】Drawing test circle on canvas');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill();
                ctx.font = '20px Arial';
                ctx.fillStyle = 'white';
                ctx.fillText('テスト描画', canvas.width / 2 - 50, canvas.height / 2);
              } else {
                console.error('【デバッグ】Could not get canvas context for test drawing');
              }
            } else {
              console.error('【デバッグ】Canvas ref is null for test drawing');
            }
          }, 1000);
        } else {
          console.error('【デバッグ】Failed to initialize MediaPipe after', maxAttempts, 'attempts');
          setError(`MediaPipe初期化失敗 (${maxAttempts}回試行)`);
        }
      } catch (err) {
        console.error('【デバッグ】初期化エラー:', err);
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
  const handleFrame = (imageData: ImageData, videoElement?: HTMLVideoElement) => {
    if (!isInitialized) {
      // MediaPipeが初期化されていない場合
      if (!warningShownRef.current) {
        // 初回のみコンソールに警告を表示
        console.warn('【デバッグ】MediaPipe is not initialized, using fallback mode');
        warningShownRef.current = true;
      }
      
      // フォールバックのモーション検出に切り替え
      fallbackMotionDetection(imageData);
      return;
    }
    
    // 警告フラグをリセット（初期化に成功した場合）
    warningShownRef.current = false;
    
    // ハンドランドマークの検出（可能であればビデオ要素を使用）
    console.log('【デバッグ】検出開始:', videoElement ? 'videoElementを使用' : 'imageDataを使用');
    const result = videoElement 
      ? detectHandLandmarks(videoElement) 
      : detectHandLandmarks(imageData);
      
    console.log('【デバッグ】検出結果:', result ? `手${result.landmarks?.length || 0}個検出` : '検出なし');
    setHandLandmarks(result);
    
    // キャンバスが利用可能か確認
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('【デバッグ】キャンバス要素が存在しません');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('【デバッグ】キャンバスコンテキストが取得できません');
      return;
    }
    
    // キャンバスが正しく描画できることをテスト
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 枠線を描画（キャンバスが表示されていることを確認）
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // 常にフレーム番号を表示（キャンバスが更新されていることを確認）
    const frameCount = (parseInt(canvas.getAttribute('data-frame') || '0') + 1) % 1000;
    canvas.setAttribute('data-frame', frameCount.toString());
    ctx.font = '20px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`Frame: ${frameCount}`, 20, 30);
    
    if (result && result.landmarks && result.landmarks.length > 0) {
      console.log('【デバッグ】描画開始: 手のランドマーク');
      // キャンバスに現在時刻を表示（処理が実行されていることを確認）
      ctx.fillText(`手の検出: ${result.landmarks.length}個`, 20, 60);
      
      // ジェスチャーの認識
      const gesture = recognizeHandGesture(result);
      if (gesture) {
        setCurrentGesture(gesture);
        onGestureDetected?.(gesture);
        
        // ジェスチャーをキャンバスに直接表示
        ctx.fillStyle = 'green';
        ctx.fillText(`ジェスチャー: ${gesture}`, 20, 90);
      }
      
      // 外部ハンドラーへの通知
      onHandLandmarksDetected?.(result);
      
      // キャンバスへの描画
      try {
        drawHandLandmarks(result);
        console.log('【デバッグ】描画完了');
      } catch (err: any) {
        console.error('【デバッグ】描画エラー:', err);
        // エラー情報をキャンバスに表示
        ctx.fillStyle = 'red';
        ctx.fillText(`描画エラー: ${err.message}`, 20, 120);
      }
    } else {
      // 手が検出されなくても何かを描画する
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('手が検出されていません', 20, canvas.height / 2);
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
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('【デバッグ】Canvas ref is null');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('【デバッグ】Could not get canvas context');
        return;
      }
      
      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // ステータス情報
      ctx.font = '14px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(`Frame: ${Date.now() % 10000}`, 10, 20);
      ctx.fillText(`手の検出: ${result.landmarks.length}個`, 10, 40);
      
      console.log(`【デバッグ】描画: 手${result.landmarks.length}個、キャンバスサイズ=${canvas.width}x${canvas.height}`);
      
      // 各検出された手について
      result.landmarks.forEach((landmarks, handIndex) => {
        console.log(`【デバッグ】手${handIndex}: ${landmarks.length}ポイント`);
        
        // 単純な点として描画
        landmarks.forEach((landmark, index) => {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();
        });
      });
    } catch (error: any) {
      console.error('【デバッグ】描画エラー:', error.message);
    }
  };
  
  return (
    <div 
      className="relative"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        margin: '0 auto',
        position: 'relative',
        border: '2px solid #ff0000'
      }}
    >
      {/* カメラ入力コンポーネント */}
      <CameraInput width={width} height={height} onFrame={handleFrame} />
      
      {/* 手のランドマーク描画用キャンバス - 絶対位置指定 */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1000, // 非常に高い値で必ず最前面に表示
          pointerEvents: 'none',
          border: '4px solid yellow',
          boxSizing: 'border-box'
        }}
      />
      
      {/* ステータス表示 - 最前面に配置 */}
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px',
          fontSize: '12px',
          zIndex: 1001,
          borderRadius: '4px'
        }}
      >
        MediaPipe: {isInitialized ? '初期化済み' : '未初期化'}
      </div>
      
      {/* 現在のジェスチャー */}
      {currentGesture && (
        <div 
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px',
            fontSize: '12px',
            zIndex: 1001,
            borderRadius: '4px'
          }}
        >
          検出: <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{currentGesture}</span>
        </div>
      )}
      
      {/* ローディング表示 */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1002
        }}>
          <div style={{ color: 'white', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>MediaPipeを読み込み中...</div>
            <div style={{ 
              width: '48px',
              height: '48px',
              border: '4px solid #3498db',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
          </div>
        </div>
      )}
      
      {/* エラー表示 */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          background: '#ffebee',
          border: '1px solid #ef5350',
          color: '#d32f2f',
          padding: '12px',
          borderRadius: '4px',
          maxWidth: '320px',
          zIndex: 1002
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>エラー</div>
          <div style={{ fontSize: '14px' }}>{error}</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>フォールバックモードで実行中...</div>
        </div>
      )}
      
      {/* スタイルをページに直接追加 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
} 