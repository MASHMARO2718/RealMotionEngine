'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { 
  initializeMediaPipePoseTracking, 
  detectPoseLandmarks, 
  analyzePoseType,
  PoseType,
  disposeMediaPipePoseTracking,
  getPoseConfidence
} from '../../lib/pose/mediapipe-pose-tracking';
import { 
  drawPoseLandmarks, 
  drawCyberpunkGrid,
  CYBERPUNK_COLORS
} from '../../lib/shared/mediapipe-utils';
import { suppressTensorFlowErrors, restoreConsoleError } from '../../utils/error-handling';

interface PoseTrackerProps {
  onPoseDetected?: (result: PoseLandmarkerResult) => void;
  onPoseTypeChange?: (poseType: PoseType) => void;
  onError?: (error: string) => void;
  showLandmarks?: boolean;
  width?: number;
  height?: number;
  glowSize?: number; // ランドマークのグロー効果サイズ
}

/**
 * サイバーパンク風のポーズトラッキングコンポーネント
 */
export default function PoseTracker({
  onPoseDetected,
  onPoseTypeChange,
  onError,
  showLandmarks = true,
  width = 640,
  height = 480,
  glowSize = 15
}: PoseTrackerProps) {
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
  const [poseType, setPoseType] = useState<PoseType>('none');
  const [poseConfidence, setPoseConfidence] = useState(0);
  // ポーズが検出されているかどうか
  const [poseDetected, setPoseDetected] = useState(false);
  
  // カメラのセットアップを直接実行できるボタン用
  const [isCameraSetupAttempted, setIsCameraSetupAttempted] = useState(false);
  
  // MediaPipeの初期化
  useEffect(() => {
    async function init() {
      // エラー抑制を有効化
      suppressTensorFlowErrors();
      
      try {
        console.log('MediaPipe Pose初期化を開始します...');
        const success = await initializeMediaPipePoseTracking();
        console.log('MediaPipe Pose初期化結果:', success);
        setIsInitialized(success);
        if (!success) {
          const errorMsg = 'MediaPipe Poseの初期化に失敗しました';
          console.error(errorMsg);
          setError(errorMsg);
          if (onError) onError(errorMsg);
          return;
        }
        
        // 初期化成功後すぐにカメラセットアップを試行
        await setupCamera();
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
      console.log('PoseTrackerコンポーネントをクリーンアップ中...');
      
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
          disposeMediaPipePoseTracking();
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
  
  // ポーズトラッキングの実行
  const runPoseTracking = useCallback((timestamp: number) => {
    if (!isInitialized || !isRunning || !videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(runPoseTracking);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(runPoseTracking);
      return;
    }

    // --- サイズ同期を徹底 ---
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // --- ミラーリングしてビデオフレームを描画 ---
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // グリッド描画を削除
    // drawCyberpunkGrid(ctx, canvas.width, canvas.height);

    // ポーズランドマーク検出
    detectPoseLandmarks(video, Math.floor(timestamp)).then(result => {
      if (result && result.landmarks && result.landmarks.length > 0) {
        setPoseDetected(true);
        const confidence = getPoseConfidence(result);
        setPoseConfidence(confidence);
        if (showLandmarks) {
          drawPoseLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
        }
        // ポーズタイプを分析
        const newPoseType = analyzePoseType(result);
        if (newPoseType !== poseType) {
          setPoseType(newPoseType);
          if (onPoseTypeChange) {
            onPoseTypeChange(newPoseType);
          }
        }
        // コールバックを呼び出し
        if (onPoseDetected) {
          onPoseDetected(result);
        }
      } else {
        setPoseDetected(false);
        setPoseConfidence(0);
      }
    }).catch(err => {
      setError(`ポーズ検出エラー: ${err.message}`);
      if (onError) onError(err.message);
    }).finally(() => {
      requestRef.current = requestAnimationFrame(runPoseTracking);
    });
  }, [isInitialized, isRunning, showLandmarks, glowSize, poseType, onPoseDetected, onPoseTypeChange, onError]);
  
  // トラッキングの開始
  useEffect(() => {
    // ハンドトラッキングアニメーションの開始
    if (isInitialized && isRunning && !requestRef.current) {
      console.log('ポーズトラッキングアニメーションを開始します...');
      requestRef.current = requestAnimationFrame(runPoseTracking);
    }
    
    return () => {
      // コンポーネントがアンマウントされたらアニメーションを停止
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isInitialized, isRunning, runPoseTracking]);
  
  // カメラの再セットアップ用ボタン
  const handleRetryCamera = useCallback(() => {
    setError(null);
    setupCamera().catch(err => {
      console.error('カメラ再セットアップエラー:', err);
      setError(`カメラエラー: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [setupCamera]);
  
  return (
    <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
      {/* ビデオ要素 */}
      <video
        ref={videoRef}
        className="rounded-lg absolute top-0 left-0"
        width={width}
        height={height}
        playsInline
        muted
        style={{
          objectFit: 'cover',
          zIndex: 1
        }}
      />
      
      {/* キャンバス要素（透明背景、ランドマークのみ表示） */}
      <canvas
        ref={canvasRef}
        className="rounded-lg absolute top-0 left-0"
        width={width}
        height={height}
        style={{
          boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
          border: '1px solid rgba(0, 255, 136, 0.8)',
          zIndex: 2,
          background: 'transparent'
        }}
      />
      
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
      <div className="absolute bottom-2 right-2 text-xs text-white bg-black bg-opacity-50 p-1 rounded">
        <p>状態: {isInitialized ? (isRunning ? '実行中' : '初期化済み') : '初期化中'}</p>
        <p>ポーズ検出: {poseDetected ? 'あり' : 'なし'}</p>
        <p>ポーズタイプ: {poseType}</p>
        <p>信頼度: {Math.floor(poseConfidence * 100)}%</p>
      </div>
    </div>
  );
} 