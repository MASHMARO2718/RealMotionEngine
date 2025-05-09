'use client';

import { useEffect, useRef, useState } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import CameraInput from './CameraInput';
import {
  initializeWasmHandTracking,
  detectWasmHandLandmarks,
  recognizeWasmHandGesture
} from '../lib/wasm-hand-tracking';

interface HandTrackerProps {
  width?: number;
  height?: number;
  onGestureDetected?: (gesture: string) => void;
  onHandLandmarksDetected?: (landmarks: HandLandmarkerResult) => void;
}

export default function WasmHandTracker({
  width = 320,
  height = 240,
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
  
  // ハンドトラッキングの初期化
  useEffect(() => {
    async function init() {
      try {
        if (initializeAttemptedRef.current) return;
        initializeAttemptedRef.current = true;
        
        setIsLoading(true);
        console.log('【デバッグ】WASM 初期化開始...');
        
        // 初期化を3回まで試行
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!success && attempts < maxAttempts) {
          attempts++;
          console.log(`【デバッグ】WASM 初期化試行 ${attempts}/${maxAttempts}...`);
          
          // WASM初期化
          success = await initializeWasmHandTracking();
          
          if (!success && attempts < maxAttempts) {
            console.log(`【デバッグ】1秒後に再試行します... (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
          }
        }
        
        if (success) {
          setIsInitialized(true);
          setError(null);
          console.log(`【デバッグ】WASM 初期化成功 (${attempts}回目の試行)`);
          
          // キャンバスが正しく描画できるか確認するためのテスト
          setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                console.log('【デバッグ】テスト円を描画中...');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, 2 * Math.PI);
                ctx.fillStyle = 'blue'; // WASMの場合は青
                ctx.fill();
                ctx.font = '20px Arial';
                ctx.fillStyle = 'white';
                ctx.fillText('WASM テスト', canvas.width / 2 - 50, canvas.height / 2);
              } else {
                console.error('【デバッグ】テスト描画用のキャンバスコンテキストが取得できません');
              }
            } else {
              console.error('【デバッグ】テスト描画用のキャンバス要素が取得できません');
            }
          }, 1000);
        } else {
          console.error(`【デバッグ】WASM 初期化失敗 (${maxAttempts}回試行)`);
          setError(`WASM 初期化失敗 (${maxAttempts}回試行)`);
        }
      } catch (err) {
        console.error('【デバッグ】初期化エラー:', err);
        setError('WASM 初期化中にエラーが発生しました');
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
  const handleFrame = async (imageData: ImageData, videoElement?: HTMLVideoElement) => {
    if (!isInitialized) {
      // 初期化されていない場合
      if (!warningShownRef.current) {
        // 初回のみコンソールに警告を表示
        console.warn('【デバッグ】WASM が初期化されていません、フォールバックモードを使用します');
        warningShownRef.current = true;
      }
      
      // フォールバックのモーション検出に切り替え
      fallbackMotionDetection(imageData);
      return;
    }
    
    // 警告フラグをリセット（初期化に成功した場合）
    warningShownRef.current = false;
    
    // ハンドランドマークの検出
    console.log('【デバッグ】検出開始:', videoElement ? 'videoElement使用' : 'imageData使用');
    
    // WASM検出
    const result = await detectWasmHandLandmarks(videoElement || imageData);
      
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
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 枠線を描画（キャンバスが表示されていることを確認）
    // WASM版は青
    ctx.strokeStyle = '#4287f5';
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
      // キャンバスに手の検出情報を表示
      ctx.fillText(`手の検出: ${result.landmarks.length}個`, 20, 60);
      
      // ジェスチャーの認識
      const gesture = recognizeWasmHandGesture(result);
        
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
      ctx.fillText('フォールバックモード: WASM利用不可', 10, 30);
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
      
      // ステータス情報
      ctx.font = '16px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(`検出: ${result.landmarks.length}個の手`, 10, 25);
      
      console.log(`【デバッグ】描画: 手${result.landmarks.length}個、キャンバスサイズ=${canvas.width}x${canvas.height}`);
      
      // 各検出された手について
      result.landmarks.forEach((landmarks, handIndex) => {
        console.log(`【デバッグ】手${handIndex}: ${landmarks.length}ポイント`);
        
        // ランドマーク間の線を描画
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],           // 親指
          [0, 5], [5, 6], [6, 7], [7, 8],           // 人差し指
          [5, 9], [9, 10], [10, 11], [11, 12],      // 中指
          [9, 13], [13, 14], [14, 15], [15, 16],    // 薬指
          [13, 17], [17, 18], [18, 19], [19, 20],   // 小指
          [0, 17], [5, 9], [9, 13], [13, 17]        // 手のひら
        ];
        
        // 手のひらの色 - WASM版
        const baseColor = handIndex === 0 
          ? { r: 0, g: 128, b: 255 } 
          : { r: 128, g: 0, b: 255 };
        
        // 線のグラデーション効果
        const lineGradient = (alpha = 0.7) => 
          `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
        
        // まず線を描画（透明度で奥行き感を出す）
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        connections.forEach(([i, j]) => {
          const point1 = landmarks[i];
          const point2 = landmarks[j];
          
          const x1 = point1.x * canvas.width;
          const y1 = point1.y * canvas.height;
          const x2 = point2.x * canvas.width;
          const y2 = point2.y * canvas.height;
          
          // 指先に近いほど濃く
          const isFingerTip = [4, 8, 12, 16, 20].includes(j);
          ctx.strokeStyle = lineGradient(isFingerTip ? 0.9 : 0.7);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });
        
        // 次にランドマークを描画
        landmarks.forEach((landmark, index) => {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          
          // 指先は特別な色で強調
          const isFingerTip = [4, 8, 12, 16, 20].includes(index);
          const isWrist = index === 0;
          
          // サイズをポイントの種類によって調整
          const radius = isFingerTip ? 7 : (isWrist ? 8 : 4);
          
          // グロー効果
          if (isFingerTip || isWrist) {
            ctx.shadowColor = isFingerTip ? 
              'rgba(255, 255, 0, 0.7)' : 
              `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.7)`;
            ctx.shadowBlur = 15;
          } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
          
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          
          if (isFingerTip) {
            // 指先は黄色
            ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
          } else if (isWrist) {
            // 手首は基本色
            ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.9)`;
          } else {
            // その他のポイント
            ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.8)`;
          }
          
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
        position: 'relative'
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
          pointerEvents: 'none'
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
        モード: WASM {isInitialized ? '初期化済み' : '未初期化'}
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
            <div style={{ marginBottom: '8px' }}>WASMを読み込み中...</div>
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