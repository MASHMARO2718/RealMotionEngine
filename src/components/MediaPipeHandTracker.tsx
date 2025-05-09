'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  HandLandmarkerResult, 
  GestureRecognizerResult 
} from '@mediapipe/tasks-vision';
import { 
  initializeMediaPipeHandTracking, 
  detectHandLandmarks, 
  recognizeGesture,
  analyzeHandGesture,
  HandGesture,
  disposeMediaPipeHandTracking
} from '../lib/mediapipe-hand-tracking';

// コンポーネントのプロパティ
interface MediaPipeHandTrackerProps {
  onHandsDetected?: (result: HandLandmarkerResult) => void;
  onGestureDetected?: (gestures: HandGesture[]) => void;
  onError?: (error: string) => void;
  useGestureRecognizer?: boolean;
  showLandmarks?: boolean;
  width?: number;
  height?: number;
}

// ランドマークの描画設定
const LANDMARK_COLORS = {
  thumb: 'red',
  indexFinger: 'blue',
  middleFinger: 'green',
  ringFinger: 'orange',
  pinky: 'purple',
  palmBase: 'yellow'
};

// 手の各部分の接続関係（インデックス番号）
const CONNECTIONS = [
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

/**
 * MediaPipeを使用してリアルタイムハンドトラッキングを行うコンポーネント
 */
export default function MediaPipeHandTracker({
  onHandsDetected,
  onGestureDetected,
  onError,
  useGestureRecognizer = false,
  showLandmarks = true,
  width = 640,
  height = 480
}: MediaPipeHandTrackerProps) {
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

  // カメラのセットアップを直接実行できるボタン用
  const [isCameraSetupAttempted, setIsCameraSetupAttempted] = useState(false);
  
  // MediaPipeの初期化
  useEffect(() => {
    async function init() {
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
      console.log('MediaPipeHandTrackerコンポーネントをクリーンアップ中...');
      
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
      
      // 少し遅延させてから MediaPipe リソースを解放
      // これによりタイミング問題を回避
      setTimeout(() => {
        try {
          console.log('MediaPipeリソースを解放します');
          disposeMediaPipeHandTracking();
        } catch (err) {
          console.warn('MediaPipeリソース解放中にエラーが発生しました:', err);
        }
      }, 100);
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
      
      // すべての使用可能なカメラ情報を列挙（デバッグ用）
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('利用可能なカメラデバイス:', videoDevices);
      } catch (enumErr) {
        console.warn('カメラデバイスの列挙に失敗しました:', enumErr);
      }
      
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
      
      // 最初にシンプルな設定で試す
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('基本カメラストリームを取得しました:', stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log('ビデオメタデータが読み込まれました');
            if (videoRef.current) {
              console.log('ビデオ再生を開始します');
              videoRef.current.play().then(() => {
                console.log('ビデオ再生成功');
                setIsRunning(true);
                setError(null); // エラーをクリア
              }).catch(e => {
                console.error('ビデオ再生に失敗しました:', e);
                setError(`ビデオ再生エラー: ${e.message}`);
              });
            }
          };
        }
        return; // 成功したので終了
      } catch (simpleErr) {
        console.warn('シンプルなビデオ設定での取得に失敗しました。詳細設定を試します:', simpleErr);
      }
      
      // より詳細な設定で再試行
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('カメラストリームを取得しました:', stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // ビデオが読み込まれたらトラッキングを開始
          videoRef.current.onloadedmetadata = () => {
            console.log('ビデオメタデータが読み込まれました');
            if (videoRef.current) {
              console.log('ビデオ再生を開始します');
              videoRef.current.play().then(() => {
                console.log('ビデオ再生成功');
                setIsRunning(true);
                setError(null); // エラーをクリア
              }).catch(e => {
                console.error('ビデオ再生に失敗しました:', e);
                setError(`ビデオ再生エラー: ${e.message}`);
              });
            }
          };
        }
      } catch (err: any) {
        console.error('カメラアクセスエラー:', err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラへのアクセスを許可してください。');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('カメラが見つかりません。カメラが接続されているか確認してください。');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('カメラエラー: 他のアプリケーションがカメラを使用している可能性があります。他のアプリケーションを閉じてください。');
        } else {
          const errorMsg = `カメラエラー: ${err.name || ''} - ${err.message || 'Unknown error'}`;
          setError(errorMsg);
          if (onError) onError(errorMsg);
        }
      }
    } catch (outerErr) {
      const errorMsg = `カメラセットアップエラー: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`;
      console.error(errorMsg, outerErr);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [height, width, onError]);
  
  // 初期化が成功したらカメラをセットアップ
  useEffect(() => {
    if (isInitialized && !isCameraSetupAttempted) {
      setupCamera();
    }
  }, [isInitialized, isCameraSetupAttempted, setupCamera]);
  
  // 手のランドマークを描画
  const drawHandLandmarks = useCallback((ctx: CanvasRenderingContext2D, result: HandLandmarkerResult) => {
    if (!result.landmarks) return;
    
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // ビデオがミラーリングされている場合の調整
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    
    result.landmarks.forEach(landmarks => {
      // 接続線を描画
      CONNECTIONS.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        ctx.beginPath();
        ctx.moveTo(startPoint.x * width, startPoint.y * height);
        ctx.lineTo(endPoint.x * width, endPoint.y * height);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      // ランドマークを描画
      landmarks.forEach((point, index) => {
        let color = 'white';
        
        // 指先は特別な色で表示
        if (index === 4) color = LANDMARK_COLORS.thumb;
        else if (index === 8) color = LANDMARK_COLORS.indexFinger;
        else if (index === 12) color = LANDMARK_COLORS.middleFinger;
        else if (index === 16) color = LANDMARK_COLORS.ringFinger;
        else if (index === 20) color = LANDMARK_COLORS.pinky;
        else if (index === 0) color = LANDMARK_COLORS.palmBase;
        
        ctx.beginPath();
        ctx.arc(
          point.x * width,
          point.y * height,
          index % 4 === 0 ? 8 : 4, // 指先は大きく
          0,
          2 * Math.PI
        );
        ctx.fillStyle = color;
        ctx.fill();
      });
    });
    
    ctx.restore();
  }, []);
  
  // フレーム処理関数
  const processFrame = useCallback(async (timestamp: number) => {
    if (!videoRef.current || !isRunning || !isInitialized) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // 一定間隔でのみ処理（30fps程度）
    if (timestamp - lastTimeRef.current < 33.33) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    lastTimeRef.current = timestamp;
    
    try {
      // 手のランドマークを検出
      const handLandmarkerResult = await detectHandLandmarks(
        videoRef.current,
        timestamp
      );
      
      if (handLandmarkerResult && showLandmarks && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          drawHandLandmarks(ctx, handLandmarkerResult);
        }
        
        // 結果をコールバックで通知
        if (onHandsDetected) {
          onHandsDetected(handLandmarkerResult);
        }
        
        // ジェスチャー検出
        let currentGestures: HandGesture[] = ['none'];
        
        if (useGestureRecognizer) {
          // MediaPipeのGestureRecognizerを使用
          const gestureResult = await recognizeGesture(videoRef.current, timestamp);
          if (gestureResult && gestureResult.gestures && gestureResult.gestures.length > 0) {
            currentGestures = gestureResult.gestures.map(g => g[0].categoryName.toLowerCase() as HandGesture);
          }
        } else {
          // 独自のジェスチャー解析を使用
          currentGestures = analyzeHandGesture(handLandmarkerResult);
        }
        
        if (currentGestures[0] !== 'none') {
          setGestures(currentGestures);
          
          // 結果をコールバックで通知
          if (onGestureDetected) {
            onGestureDetected(currentGestures);
          }
        }
      }
    } catch (err) {
      console.error('フレーム処理エラー:', err);
    }
    
    // 次のフレームを処理
    requestRef.current = requestAnimationFrame(processFrame);
  }, [isRunning, isInitialized, drawHandLandmarks, onHandsDetected, onGestureDetected, showLandmarks, useGestureRecognizer]);
  
  // アニメーションフレームのセットアップ
  useEffect(() => {
    if (isRunning && isInitialized) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isRunning, isInitialized, processFrame]);
  
  return (
    <div className="relative">
      {error && (
        <div className="absolute top-0 left-0 w-full bg-red-500 text-white p-2 z-10">
          {error}
          {(error.includes('カメラエラー') || error.includes('初期化エラー')) && (
            <button
              className="ml-2 px-2 py-1 bg-white text-red-600 rounded text-sm font-bold"
              onClick={setupCamera}
            >
              カメラを再試行
            </button>
          )}
        </div>
      )}
      
      <div className="relative">
        {/* カメラ権限が拒否されている場合のメッセージ */}
        {cameraPermission === 'denied' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20 text-white p-4 text-center">
            <div>
              <p className="mb-4">カメラへのアクセスが拒否されています。</p>
              <p className="mb-4">ブラウザの設定からカメラへのアクセスを許可してください。</p>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={setupCamera}
              >
                カメラアクセスを再度リクエスト
              </button>
            </div>
          </div>
        )}
        
        {!isInitialized && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20 text-white">
            <p>MediaPipeを初期化中...</p>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="w-full h-auto"
          width={width}
          height={height}
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }} // ミラーリング
        />
        
        {showLandmarks && (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            width={width}
            height={height}
            style={{ transform: 'scaleX(-1)' }} // ミラーリング
          />
        )}
      </div>
      
      <div className="bg-black text-white p-2 mt-2 rounded">
        <p>検出されたジェスチャー: {gestures.join(', ')}</p>
        
        {/* 手動カメラ起動ボタン */}
        {!isRunning && (
          <button
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded block w-full"
            onClick={setupCamera}
          >
            カメラを起動
          </button>
        )}
      </div>
    </div>
  );
} 