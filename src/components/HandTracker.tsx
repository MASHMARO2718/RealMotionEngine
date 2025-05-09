'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HandLandmarkerResult, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import { 
  initializeMediaPipeHandTracking, 
  detectHandLandmarks, 
  recognizeGesture,
  analyzeHandGesture,
  HandGesture,
  disposeMediaPipeHandTracking
} from '../lib/mediapipe-hand-tracking';
import { 
  drawHandLandmarks, 
  drawCyberpunkGrid, 
  drawScanningMessage, 
  CYBERPUNK_COLORS
} from '../lib/mediapipe-utils';
import { suppressTensorFlowErrors, restoreConsoleError } from '../utils/error-handling';

interface HandTrackerProps {
  onHandsDetected?: (result: HandLandmarkerResult) => void;
  onGestureDetected?: (gestures: HandGesture[]) => void;
  onError?: (error: string) => void;
  useGestureRecognizer?: boolean;
  showLandmarks?: boolean;
  width?: number;
  height?: number;
  glowSize?: number; // 指先のグロー効果サイズ
}

/**
 * サイバーパンク風のハンドトラッキングコンポーネント
 */
export default function HandTracker({
  onHandsDetected,
  onGestureDetected,
  onError,
  useGestureRecognizer = false,
  showLandmarks = true,
  width = 640,
  height = 480,
  glowSize = 25 // デフォルトのグローサイズを大きく
}: HandTrackerProps) {
  // ビデオとキャンバスの参照
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 状態
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  // 検出結果
  const [gestures, setGestures] = useState<HandGesture[]>(['none']);
  // 手が検出されているかどうか
  const [handsDetected, setHandsDetected] = useState(false);
  
  // カメラのセットアップを直接実行できるボタン用
  const [isCameraSetupAttempted, setIsCameraSetupAttempted] = useState(false);
  
  // MediaPipeの初期化
  useEffect(() => {
    async function init() {
      // エラー抑制を有効化
      suppressTensorFlowErrors();
      
      try {
        console.log('MediaPipe初期化を開始します...');
        const success = await initializeMediaPipeHandTracking();
        console.log('MediaPipe初期化結果:', success);
        setIsInitialized(success);
        if (!success) {
          const errorMsg = 'MediaPipeの初期化に失敗しました';
          console.error(errorMsg);
          setError(errorMsg);
          if (onError) onError(errorMsg);
          return;
        }
      } catch (err) {
        const errorMsg = `初期化エラー: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMsg, err);
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    }
    
    init();
    
    // クリーンアップ
    return () => {
      console.log('HandTrackerコンポーネントをクリーンアップ中...');
      
      // アニメーションフレームをキャンセル
      if (requestRef.current) {
        console.log('アニメーションフレームをキャンセル');
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      
      // ビデオストリームを停止
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          console.log('ビデオストリームを停止します');
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`トラック ${track.kind} を停止しました`);
          });
          videoRef.current.srcObject = null;
        } catch (err) {
          console.warn('ビデオストリームの停止中にエラーが発生しました:', err);
        }
      }
      
      // MediaPipe リソースを安全に解放
      setTimeout(() => {
        try {
          console.log('MediaPipeリソースを解放します');
          disposeMediaPipeHandTracking();
        } catch (err) {
          console.warn('MediaPipeリソース解放中にエラーが発生しました:', err);
        }
      }, 300);
      
      // エラー抑制を元に戻す
      restoreConsoleError();
    };
  }, [onError]);
  
  // カメラのセットアップ
  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    setIsCameraSetupAttempted(true);
    
    try {
      console.log('カメラのセットアップを開始します...');
      
      // 既存のビデオストリームがあれば停止
      if (videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        console.log('既存のビデオストリームを停止しました');
      }
      
      // カメラ設定
      const constraints = {
        audio: false,
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: 'user' // フロントカメラを優先
        }
      };
      
      // カメラの権限をチェック
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          
          permissionStatus.onchange = () => {
            setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          };
        } catch (permError) {
          console.warn('カメラ権限ステータスを取得できません:', permError);
        }
      }
      
      console.log('カメラストリームを要求しています...', constraints);
      
      // カメラストリームを取得
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('カメラストリームを取得しました:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // ビデオが読み込まれたらトラッキングを開始
        videoRef.current.onloadedmetadata = () => {
          console.log('ビデオメタデータが読み込まれました');
          
          if (videoRef.current && canvasRef.current) {
            // キャンバスのサイズをビデオサイズに合わせる
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            
            // ビデオを再生
            videoRef.current.play().then(() => {
              console.log('ビデオ再生を開始しました');
              setIsRunning(true);
            }).catch((err) => {
              console.error('ビデオ再生に失敗しました:', err);
              setError(`ビデオ再生エラー: ${err.message}`);
              if (onError) onError(`ビデオ再生エラー: ${err.message}`);
            });
          }
        };
      }
    } catch (err) {
      console.error('カメラのセットアップに失敗しました:', err);
      const errorMsg = `カメラエラー: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [width, height, onError]);
  
  // ハンドトラッキングの実行
  const runHandTracking = useCallback((timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !isInitialized || !isRunning) {
      requestRef.current = requestAnimationFrame(runHandTracking);
      return;
    }
    
    // 前回の検出から時間があまり経過していない場合はスキップ
    // タイムスタンプの不一致エラーを防ぐために、より長い間隔を設定
    if (timestamp - lastTimeRef.current < 100) { // 約10fps
      requestRef.current = requestAnimationFrame(runHandTracking);
      return;
    }
    
    lastTimeRef.current = timestamp;
    
    // キャンバスコンテキストを取得
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      requestRef.current = requestAnimationFrame(runHandTracking);
      return;
    }
    
    // ビデオフレームの描画（ミラーリング）
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // ビデオをミラーリングして描画
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // サイバーパンク風グリッドを描画
    drawCyberpunkGrid(ctx, canvas.width, canvas.height);
    
    // 手のランドマーク検出を実行
    // タイムスタンプを明示的に渡す
    detectHandLandmarks(video, Math.floor(timestamp)).then(result => {
      if (result && result.landmarks && result.landmarks.length > 0) {
        // 手が検出された
        setHandsDetected(true);
        
        // ランドマークを描画
        if (showLandmarks) {
          drawHandLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
        }
        
        // 検出結果を親コンポーネントに通知
        if (onHandsDetected) {
          onHandsDetected(result);
        }
        
        // ジェスチャー認識を実行（オプション）
        if (useGestureRecognizer) {
          // 手のジェスチャーを分析
          const detectedGestures = analyzeHandGesture(result);
          setGestures(detectedGestures);
          
          // ジェスチャー検出結果を親コンポーネントに通知
          if (onGestureDetected) {
            onGestureDetected(detectedGestures);
          }
        }
      } else {
        // 手が検出されなかった
        setHandsDetected(false);
        
        // スキャニングメッセージを表示
        drawScanningMessage(ctx, canvas.width, canvas.height);
      }
    }).catch(err => {
      console.error('ハンドトラッキングエラー:', err);
      // エラーメッセージを表示
      if (ctx) {
        ctx.font = '16px monospace';
        ctx.fillStyle = 'red';
        ctx.fillText(`エラー: ${err.message}`, 10, 30);
      }
    }).finally(() => {
      // 次のフレームをリクエスト
      // エラーが発生してもアニメーションを続ける
      requestRef.current = requestAnimationFrame(runHandTracking);
    });
    
  }, [isInitialized, isRunning, showLandmarks, onHandsDetected, useGestureRecognizer, onGestureDetected, glowSize]);
  
  // トラッキングの開始
  useEffect(() => {
    // カメラが準備できたらハンドトラッキングを開始
    if (isInitialized && !error) {
      setupCamera().catch(err => {
        console.error('カメラセットアップエラー:', err);
      });
    }
    
    // ハンドトラッキングアニメーションの開始
    if (isInitialized && isRunning && !requestRef.current) {
      requestRef.current = requestAnimationFrame(runHandTracking);
    }
    
    return () => {
      // コンポーネントがアンマウントされたらアニメーションを停止
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isInitialized, isRunning, error, setupCamera, runHandTracking]);
  
  // カメラの再セットアップ用ボタン
  const handleRetryCamera = useCallback(() => {
    setError(null);
    setupCamera().catch(err => {
      console.error('カメラ再セットアップエラー:', err);
      setError(`カメラエラー: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [setupCamera]);
  
  return (
    <div className="relative">
      {/* エラー表示 */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-10 p-4">
          <div className="text-red-500 mb-4 max-w-md text-center">
            <p className="text-xl font-bold mb-2">エラーが発生しました</p>
            <p>{error}</p>
          </div>
          <button
            onClick={handleRetryCamera}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            カメラを再試行
          </button>
        </div>
      )}
      
      {/* カメラ許可が必要な場合 */}
      {cameraPermission === 'denied' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10 p-4">
          <div className="text-red-500 max-w-md text-center">
            <p className="text-xl font-bold mb-2">カメラへのアクセスが拒否されました</p>
            <p>ブラウザの設定でカメラアクセスを許可してください。</p>
          </div>
        </div>
      )}
      
      {/* カメラが初期化されていない場合のセットアップボタン */}
      {!isRunning && !error && !isCameraSetupAttempted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10 p-4">
          <button
            onClick={handleRetryCamera}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:from-blue-600 hover:to-purple-700 transition shadow-lg"
            style={{
              boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)',
              border: '1px solid rgba(0, 255, 255, 0.8)'
            }}
          >
            カメラを有効化
          </button>
        </div>
      )}
      
      {/* 状態表示（デバッグ用） */}
      <div className="absolute top-2 left-2 text-xs text-white bg-black bg-opacity-50 p-1 rounded">
        <p>状態: {isInitialized ? (isRunning ? '実行中' : '初期化済み') : '初期化中'}</p>
        <p>手検出: {handsDetected ? 'あり' : 'なし'}</p>
        {useGestureRecognizer && <p>ジェスチャー: {gestures.join(', ')}</p>}
      </div>
      
      {/* ビデオ要素（非表示） */}
      <video
        ref={videoRef}
        className="invisible absolute top-0 left-0"
        width={width}
        height={height}
        playsInline
        muted
      />
      
      {/* キャンバス要素 */}
      <canvas
        ref={canvasRef}
        className="rounded-lg"
        width={width}
        height={height}
        style={{
          boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
          border: '1px solid rgba(0, 255, 136, 0.8)'
        }}
      />
    </div>
  );
} 